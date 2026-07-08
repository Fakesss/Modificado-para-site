from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import bcrypt
from jose import JWTError, jwt
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client.get_default_database()

SECRET_KEY = os.environ['SECRET_KEY']
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

security = HTTPBearer()

app = FastAPI(title="Ranking Matemática API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============== MOTOR DE FUSO HORÁRIO (BRASÍLIA UTC-3) ==============
def get_now_brt() -> datetime:
    return datetime.utcnow() - timedelta(hours=3)

# ============== MODELS ==============
class Turma(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nome: str
    anoLetivo: int = 2025
    ativa: bool = True

class Equipe(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nome: str
    cor: str
    turmaId: Optional[str] = None
    pontosTotais: int = 0

class Usuario(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nome: str
    email: str
    senha: str
    perfil: str = "ALUNO"
    turmaId: Optional[str] = None
    equipeId: Optional[str] = None
    ativo: bool = True
    streakDias: int = 0
    streakUltimoLoginData: Optional[str] = None
    pontosTotais: int = 0
    recordeJogoSingle: int = 0
    recordeJogoMulti: int = 0
    recordeMathBlaster: int = 0  
    criadoEm: str = Field(default_factory=lambda: get_now_brt().isoformat())
    ultimoAcesso: Optional[str] = None
    dataUltimoPontoArcade: Optional[str] = None
    ocultoChat: bool = False

class UsuarioCreate(BaseModel):
    nome: str
    email: str
    senha: str
    turmaId: Optional[str] = None
    equipeId: Optional[str] = None

class UsuarioLogin(BaseModel):
    email: str
    senha: str

class UsuarioUpdate(BaseModel):
    nome: Optional[str] = None
    perfil: Optional[str] = None
    turmaId: Optional[str] = None
    equipeId: Optional[str] = None
    ativo: Optional[bool] = None

class AdminUsuarioUpdate(BaseModel):
    nome: Optional[str] = None
    perfil: Optional[str] = None
    turmaId: Optional[str] = None
    equipeId: Optional[str] = None
    senha: Optional[str] = None
    ativo: Optional[bool] = None
    pontosTotais: Optional[int] = None
    recordeJogoSingle: Optional[int] = None
    recordeMathBlaster: Optional[int] = None 
    ocultoChat: Optional[bool] = None

class ArcadeScore(BaseModel):
    pontos: int

class MathBlasterScore(BaseModel):  
    pontos: int

class PremiacaoRequest(BaseModel):
    tipo: str # "ARCADE" ou "MATH_BLASTER"
    pts1: int
    pts2: int
    pts3: int

class PontuacaoJogo(BaseModel):
    jogo: str    # "arcade" | "math_blaster" | "cabo_de_guerra" | "tictactoe"
    pontos: int  # pontuação BRUTA da partida (calculada pelo próprio jogo)

class Construcao(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tipo: str
    slot: int
    nivel: int = 1

class Reino(BaseModel):
    equipeId: str
    moedas: int = 0
    construcoes: List[Construcao] = []

class ReinoConstruirRequest(BaseModel):
    tipo: str
    slot: int

class ReinoUpgradeRequest(BaseModel):
    construcaoId: str

class SudokuSessao(BaseModel):
    puzzle: List[int]
    solution: List[int]
    userBoard: List[int]
    pencilMarks: List[List[int]]
    hintedCells: List[int] = []
    lives: int = 3
    hintsLeft: int = 3
    difficulty: str
    elapsedSeconds: int = 0
    completed: bool = False
    lost: bool = False

class SudokuConclusao(BaseModel):
    difficulty: str
    elapsedSeconds: int
    hintsUsed: int

class HangarPerfil(BaseModel):
    # Nome exibido no app: "Garagem". O prefixo interno "hangar" (rotas, coleção
    # db.hangar_perfis) é mantido de propósito pra não quebrar apps já instalados.
    usuarioId: str
    moedas: int = 0
    armaInicial: str = "PADRAO"  # PADRAO | ELETRICA | PLASMA | LEQUE
    armasDesbloqueadas: List[str] = ["PADRAO"]
    nivelCDR: int = 0
    nivelVelocidade: int = 0
    nivelDano: int = 0
    nivelCasco: int = 0          # +12 de vida máxima por nível
    nivelEscudo: int = 0         # cargas de escudo no início da partida (1 a cada 2 níveis, máx 4)
    nivelDanoEspecial: int = 0   # +6% de dano das armas especiais por nível (cap +48%)
    corNave: str = "#00FFFF"
    habilidadeSecretaDesbloqueada: bool = False

class HangarUpgradeRequest(BaseModel):
    atributo: str  # "cdr" | "velocidade" | "dano"

class HangarArmaRequest(BaseModel):
    arma: str

class HangarCorRequest(BaseModel):
    cor: str

class HangarCodigoRequest(BaseModel):
    codigo: str

class HangarInjetarMoedasRequest(BaseModel):
    codigoMaster: str
    quantidade: int

class HangarGanharMoedasRequest(BaseModel):
    pontos: int

class HangarResetItemRequest(BaseModel):
    item: str  # arma ("ELETRICA"/"PLASMA"/"LEQUE") ou atributo ("cdr"/"velocidade"/"dano"/"casco"/"escudo"/"danoespecial")

class ConfiguracaoJogo(BaseModel):
    jogoId: str = "math_blaster"
    dropRateMultiplier: float = 1.0
    powerupsHabilitados: List[str] = []
    spawnChancePorInimigo: Dict[str, int] = {}

class TabuadaRespostaItem(BaseModel):
    operacao: str            # "7x8" ou "custom:<id>" (flash card criado pelo aluno)
    fator1: Optional[int] = None
    fator2: Optional[int] = None
    respostaCorreta: int
    respostaDada: int
    acertou: bool
    tempoResposta: float     # segundos
    nivelAntes: int          # nível Leitner antes da resposta (1..5)
    nivelDepois: int         # nível Leitner depois da resposta (1..5)
    proximaRevisao: str      # ISO, calculada pelo módulo Leitner do app
    classificacao: str = "NORMAL"  # ERRO | LENTA | NORMAL | RAPIDA
    respondidoEm: str        # ISO, momento em que o aluno respondeu
    usouDica: bool = False
    usouOpcoes: bool = False

class TabuadaSessaoRequest(BaseModel):
    modulo: str = "tabuada"
    respostas: List[TabuadaRespostaItem]

class TabuadaFlashcardCreate(BaseModel):
    tipo: str                       # "CONTA" | "TEXTO"
    enunciado: str
    respostaCorreta: int
    dica: Optional[str] = None
    opcoes: Optional[List[int]] = None
    jogoId: Optional[str] = None    # se preenchido, o card pertence a um jogo personalizado
                                     # isolado (não entra na fila principal da Trilha da Tabuada)

class JogoPersonalizadoCreate(BaseModel):
    nome: str

class TabuadaDesafioSubmissao(BaseModel):
    tabuadas: List[int]        # quais tabuadas (1..10) o aluno escolheu praticar
    quantidadeQuestoes: int    # 15 | 20 | 30
    acertos: int
    tempoTotalSegundos: float

# =========================================================================
# CONFIGURAÇÃO DE PONTOS POR JOGO (painel de ajuste manual)
# -------------------------------------------------------------------------
# "divisor"       -> a pontuação bruta enviada pelo jogo é dividida por isso
#                    antes de virar ponto de equipe (deixa o número "justo")
# "limite_diario" -> quantos pontos de EQUIPE cada aluno pode gerar POR DIA
#                    em cada jogo (e não por partida!). Depois de bater o
#                    limite, o aluno pode continuar jogando à vontade, só
#                    não soma mais ponto pra equipe naquele dia. Isso é o
#                    que evita a pontuação de "inflacionar" com grinding.
# Pra ajustar a dificuldade/generosidade de um jogo no futuro, só mude os
# números aqui — não precisa tocar em mais nada.
# =========================================================================
CONFIG_PONTOS_JOGOS: Dict[str, Dict[str, int]] = {
    "arcade":         {"divisor": 10, "limite_diario": 40},
    "math_blaster":   {"divisor": 25, "limite_diario": 40},
    "cabo_de_guerra": {"divisor": 1,  "limite_diario": 24},
    "tictactoe":      {"divisor": 1,  "limite_diario": 18},
}

# =========================================================================
# CATÁLOGO DO REINO (construções que uma equipe pode erguer/evoluir)
# -------------------------------------------------------------------------
# "custoBase"    -> custo em moedas pra construir pela primeira vez
# "custoUpgrade" -> custo base pra subir de nível (custo = custoUpgrade *
#                   nível atual da construção)
# "nivelMax"     -> nível máximo que essa construção pode atingir
# O CASTELO é especial: vem grátis no terreno 0 de todo reino novo e define
# quantos terrenos a equipe tem disponíveis (8 + (nívelCastelo-1)*4).
# =========================================================================
CATALOGO_REINO: Dict[str, Dict[str, Any]] = {
    "CASTELO":    {"nome": "Castelo",        "icone": "business", "custoBase": 0,  "custoUpgrade": 100, "nivelMax": 10},
    "TORRE":      {"nome": "Torre do Saber", "icone": "school",   "custoBase": 50, "custoUpgrade": 40,  "nivelMax": 5},
    "MURALHA":    {"nome": "Muralha",        "icone": "shield",   "custoBase": 60, "custoUpgrade": 50,  "nivelMax": 5},
    "ESTANDARTE": {"nome": "Estandarte",     "icone": "flag",     "custoBase": 30, "custoUpgrade": 25,  "nivelMax": 3},
    "DECORACAO":  {"nome": "Jardim",         "icone": "leaf",     "custoBase": 20, "custoUpgrade": 15,  "nivelMax": 3},
}

def calcular_slots_disponiveis(construcoes: List[dict]) -> int:
    castelo = next((c for c in construcoes if c["tipo"] == "CASTELO"), None)
    nivel_castelo = castelo["nivel"] if castelo else 1
    return 8 + (nivel_castelo - 1) * 4

# =========================================================================
# HANGAR DA NAVE (progressão permanente do jogador no Equações Espaciais)
# -------------------------------------------------------------------------
# Curva de progressão amortecida (soft-cap): cada nível custa mais que o
# anterior (custoBase * fatorCrescimento^nivelAtual) e o EFEITO de cada
# atributo também é limitado (ver aplicação em sky_equations.web.tsx), pra
# não deixar a nave overpower rapidamente mesmo com muitas moedas.
# =========================================================================
HANGAR_CUSTO_BASE: Dict[str, int] = {"cdr": 40, "velocidade": 35, "dano": 45, "casco": 50, "escudo": 55, "danoespecial": 60}
HANGAR_CAMPOS_NIVEL: Dict[str, str] = {
    "cdr": "nivelCDR", "velocidade": "nivelVelocidade", "dano": "nivelDano",
    "casco": "nivelCasco", "escudo": "nivelEscudo", "danoespecial": "nivelDanoEspecial",
}
HANGAR_FATOR_CRESCIMENTO = 1.4
HANGAR_NIVEL_MAX = 8
HANGAR_FRACAO_REEMBOLSO = 0.25  # redefinir devolve só 25% do que foi gasto (decisão do professor)

def custo_upgrade_hangar(atributo: str, nivel_atual: int) -> int:
    base = HANGAR_CUSTO_BASE.get(atributo, 40)
    return int(base * (HANGAR_FATOR_CRESCIMENTO ** nivel_atual))

def calcular_gastos_hangar(perfil: dict) -> Dict[str, Any]:
    """Quanto o jogador já gastou em cada item comprável da Garagem (armas e níveis
    de atributo). Fonte única usada tanto pra MOSTRAR os valores antes de confirmar
    uma redefinição quanto pra CALCULAR o reembolso de 25% — nunca podem divergir."""
    itens: Dict[str, int] = {}
    for arma, info in HANGAR_ARMAS_CATALOGO.items():
        if arma != "PADRAO" and arma in perfil.get("armasDesbloqueadas", []) and info["custo"] > 0:
            itens[arma] = info["custo"]
    for atributo, campo in HANGAR_CAMPOS_NIVEL.items():
        nivel = perfil.get(campo, 0) or 0
        if nivel > 0:
            itens[atributo] = sum(custo_upgrade_hangar(atributo, n) for n in range(nivel))
    return {"itens": itens, "total": sum(itens.values())}

HANGAR_ARMAS_CATALOGO: Dict[str, Dict[str, Any]] = {
    "PADRAO":   {"nome": "Padrão",        "descricao": "Tiro simples e equilibrado.",              "custo": 0},
    "ELETRICA": {"nome": "Elétrica",      "descricao": "Salta entre inimigos próximos.",           "custo": 80},
    "PLASMA":   {"nome": "Rajada de Plasma", "descricao": "Cadência lenta, dano alto.",               "custo": 150},
    "LEQUE":    {"nome": "Tiro em Leque",    "descricao": "Três projéteis em leque, sempre ativo.",   "custo": 150},
}

HANGAR_CORES_DISPONIVEIS = ["#00FFFF", "#FF00FF", "#7FFF00", "#FFD700", "#FF4444", "#BB77FF", "#FF7055", "#FFFFFF"]

HANGAR_CODIGO_SECRETO = "OVERDRIVE"        # desbloqueia o slot de habilidade secreta (digitado na tela da Garagem)
ADMIN_SANDBOX_MASTER_CODE = "SANDBOX9000"  # backdoor do admin pra injetar moedas de teste

async def get_or_create_hangar_perfil(usuario_id: str) -> dict:
    perfil = await db.hangar_perfis.find_one({"usuarioId": usuario_id})
    if not perfil:
        novo = HangarPerfil(usuarioId=usuario_id)
        await db.hangar_perfis.insert_one(novo.dict())
        perfil = novo.dict()
    # Perfis antigos no banco não têm os campos criados depois (ex: nivelCasco) —
    # mescla com os defaults do modelo pra toda rota/tela sempre ver o shape completo.
    completo = HangarPerfil(usuarioId=usuario_id).dict()
    completo.update(perfil)
    return completo

# =========================================================================
# CONFIGURAÇÃO GLOBAL DE PARTIDA (painel "live tweaking" do admin)
# =========================================================================
DEFAULT_POWERUP_FAMILIES = [
    "DAMAGE", "FIRE_RATE", "TRIPLE_SHOT", "HULL_UPGRADE", "MISSILE", "LASER",
    "PULSAR", "CHAIN", "ELECTRIC", "MINE", "FORCE_SHIELD", "DRONE", "TIME_FREEZE", "X_RAY"
]
DEFAULT_ENEMY_SPAWN_CHANCE = {
    "METEOR": 100, "FLANKER": 100, "SHIELD_TANK": 100, "SWARMLING": 100,
    "SQUAD": 100, "SPAWNER": 100, "GHOST": 100,
}

async def aplicar_pontos_diarios_jogo(usuario_id: str, equipe_id: Optional[str], jogo: str, pontos_brutos: int) -> dict:
    """Converte a pontuação bruta de uma partida em ponto de equipe,
    respeitando um limite diário por aluno+jogo. Retorna quanto foi
    realmente concedido (pode ser menos do que o calculado, ou zero,
    se o limite do dia já tiver sido atingido)."""
    cfg = CONFIG_PONTOS_JOGOS.get(jogo, {"divisor": 10, "limite_diario": 20})
    divisor = max(1, cfg["divisor"])
    limite = cfg["limite_diario"]

    pontos_calculados = int(pontos_brutos // divisor)
    if pontos_calculados <= 0:
        return {"pontosGanhos": 0, "pontosHojeNesseJogo": 0, "limiteDiario": limite, "limiteAtingido": False}

    data_hoje = get_now_brt().strftime("%Y-%m-%d")
    filtro = {"usuarioId": usuario_id, "jogo": jogo, "data": data_hoje}
    registro = await db.pontos_diarios_jogos.find_one(filtro)
    ja_ganho_hoje = registro.get("pontosHoje", 0) if registro else 0

    espaco_restante = max(limite - ja_ganho_hoje, 0)
    pontos_validos = max(min(pontos_calculados, espaco_restante), 0)

    if pontos_validos > 0:
        await db.pontos_diarios_jogos.update_one(
            filtro, {"$inc": {"pontosHoje": pontos_validos}, "$setOnInsert": {"id": str(uuid.uuid4())}},
            upsert=True
        )
        await db.usuarios.update_one({"id": usuario_id}, {"$inc": {"pontosTotais": pontos_validos}})
        if equipe_id:
            await db.equipes.update_one({"id": str(equipe_id).strip()}, {"$inc": {"pontosTotais": pontos_validos}})

    total_hoje = ja_ganho_hoje + pontos_validos
    return {
        "pontosGanhos": pontos_validos,
        "pontosHojeNesseJogo": total_hoje,
        "limiteDiario": limite,
        "limiteAtingido": total_hoje >= limite,
    }

class Conteudo(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tipo: str
    titulo: str
    descricao: Optional[str] = None
    urlVideo: Optional[str] = None
    arquivo: Optional[str] = None
    thumbnail: Optional[str] = None  
    pasta: Optional[str] = None      
    ordem: int = 0
    abaCategoria: str = "videos"
    turmaId: Optional[str] = None
    pontos: int = 0 
    ativo: bool = True
    criadoEm: str = Field(default_factory=lambda: get_now_brt().isoformat())
    is_deleted: bool = False
    deleted_at: Optional[str] = None

class ConteudoCreate(BaseModel):
    tipo: str
    titulo: str
    descricao: Optional[str] = None
    urlVideo: Optional[str] = None
    arquivo: Optional[str] = None  
    thumbnail: Optional[str] = None  
    pasta: Optional[str] = None      
    ordem: int = 0
    abaCategoria: str = "videos"
    turmaId: Optional[str] = None
    pontos: int = 0

class Alternativa(BaseModel):
    letra: str
    texto: str
    cor: str = "#4169E1"

class Questao(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    exercicioId: str
    numero: int
    tipoResposta: str
    enunciado: str
    imagemBase64: Optional[str] = None
    alternativas: List[Alternativa] = []
    correta: str = ""
    pontuacaoMax: float = 1.0
    habilidadesBNCC: List[str] = []

class QuestaoCreate(BaseModel):
    numero: int
    tipoResposta: str
    enunciado: str
    imagemBase64: Optional[str] = None
    alternativas: List[Dict[str, str]] = []
    correta: str = ""
    pontuacaoMax: float = 1.0
    habilidadesBNCC: List[str] = []

class Exercicio(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    titulo: str
    descricao: Optional[str] = None
    modoCriacao: str = "MANUAL"
    pdfArquivo: Optional[str] = None
    habilidadesBNCC: List[str] = []
    ativo: bool = True
    turmaId: Optional[str] = None
    equipeId: Optional[str] = None
    alunoId: Optional[str] = None
    pontosPorQuestao: float = 1.0
    criadoEm: str = Field(default_factory=lambda: get_now_brt().isoformat())
    is_deleted: bool = False
    deleted_at: Optional[str] = None

class ExercicioCreate(BaseModel):
    titulo: str
    descricao: Optional[str] = None
    modoCriacao: str = "MANUAL"
    pdfArquivo: Optional[str] = None
    habilidadesBNCC: List[str] = []
    turmaId: Optional[str] = None
    equipeId: Optional[str] = None
    alunoId: Optional[str] = None
    pontosPorQuestao: float = 1.0
    questoes: List[QuestaoCreate] = []

class ExercicioUpdate(BaseModel):
    titulo: Optional[str] = None
    descricao: Optional[str] = None
    habilidadesBNCC: Optional[List[str]] = None
    turmaId: Optional[str] = None
    equipeId: Optional[str] = None
    alunoId: Optional[str] = None
    pontosPorQuestao: Optional[float] = None
    questoes: Optional[List[QuestaoCreate]] = None

class RespostaQuestao(BaseModel):
    questaoId: str
    resposta: str

class Submissao(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    exercicioId: str
    usuarioId: str
    data: str = Field(default_factory=lambda: get_now_brt().isoformat())
    respostas: List[Dict[str, str]] = []
    acertos: int = 0
    erros: int = 0
    nota: float = 0.0
    pontosGerados: int = 0
    detalhesQuestoes: List[Dict[str, Any]] = []
    ignorarNoRelatorioBNCC: bool = False

class SubmissaoCreate(BaseModel):
    exercicioId: str
    respostas: List[RespostaQuestao]

class Token(BaseModel):
    access_token: str
    token_type: str
    usuario: Dict[str, Any]

class EquipeUpdate(BaseModel):
    nome: Optional[str] = None
    cor: Optional[str] = None
    ativa: Optional[bool] = None

class MissaoQuestao(BaseModel):
    id: str
    texto: str
    resposta: int

class MissaoCreate(BaseModel):
    titulo: str
    alvoTipo: str  
    alvoNome: str
    alvoId: str
    questoes: List[MissaoQuestao] = []
    recompensa: int = 0
    vidas: int = 3
    limiteTentativas: int = 1  
    criadoEm: Optional[str] = None
    expiraEm: Optional[str] = None

class Missao(MissaoCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    criadaPor: Optional[str] = None

class ReenviarData(BaseModel):
    alvoTipo: str
    alvoNome: str
    alvoId: str

class MensagemPrivadaCreate(BaseModel):
    destinatarioId: str
    texto: str

class BloqueioChatCreate(BaseModel):
    usuarioId1: str
    usuarioId2: str

# ============== HELPERS ==============
def verify_password(plain_password: str, hashed_password: str) -> bool:
    try: return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception: return False

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None: raise HTTPException(status_code=401, detail="Token inválido")
    except JWTError: raise HTTPException(status_code=401, detail="Token inválido")
    
    user = await db.usuarios.find_one({"id": user_id})
    if user is None: raise HTTPException(status_code=401, detail="Usuário não encontrado")
    return user

async def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("perfil") != "ADMIN": raise HTTPException(status_code=403, detail="Acesso negado")
    return current_user

def calculate_streak(last_login: Optional[str], current_streak: int) -> tuple:
    today = get_now_brt().date()
    if not last_login: 
        return current_streak + 1, today.isoformat()
    try:
        last_date_str = str(last_login)[:10] 
        last_date = datetime.strptime(last_date_str, "%Y-%m-%d").date()
        if last_date == today:
            return current_streak, last_login
        else:
            return current_streak + 1, today.isoformat()
    except Exception: 
        return current_streak + 1, today.isoformat()

def parse_turma_grade(nome: str) -> int:
    match = re.search(r'(\d+)º', nome)
    if match: return int(match.group(1))
    return 99

def get_bncc_grade(codigo: str) -> int:
    match = re.search(r'EF(\d{2})', codigo.upper())
    if match:
        val = match.group(1)
        if val == '67': return 7 
        if val == '89': return 9
        return int(val)
    return 0

# ============== MOTOR DO PONTO DIÁRIO ==============
async def registrar_ponto_diario(user: dict):
    hoje_str = get_now_brt().date().isoformat()
    last_str = str(user.get("streakUltimoLoginData"))[:10] if user.get("streakUltimoLoginData") else None
    
    agora = get_now_brt().isoformat()
    updates = {"ultimoAcesso": agora}
    
    if hoje_str != last_str:
        new_streak, new_date = calculate_streak(user.get("streakUltimoLoginData"), user.get("streakDias", 0))
        updates["streakDias"] = new_streak
        updates["streakUltimoLoginData"] = new_date
        
        await db.usuarios.update_one(
            {"id": user["id"]}, 
            {"$set": updates, "$inc": {"pontosTotais": 1}}
        )
        user["pontosTotais"] = user.get("pontosTotais", 0) + 1
        
        eq_id = user.get("equipeId")
        if eq_id:
            await db.equipes.update_one({"id": eq_id}, {"$inc": {"pontosTotais": 1}})
    else:
        await db.usuarios.update_one({"id": user["id"]}, {"$set": updates})

    for k, v in updates.items():
        user[k] = v
        
    return user

# ============== ROUTES ==============
@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UsuarioCreate):
    existing = await db.usuarios.find_one({"email": user_data.email})
    if existing: raise HTTPException(status_code=400, detail="Email já cadastrado")
    usuario = Usuario(
        nome=user_data.nome, email=user_data.email, senha=get_password_hash(user_data.senha),
        turmaId=user_data.turmaId, equipeId=user_data.equipeId, streakDias=1, 
        streakUltimoLoginData=get_now_brt().date().isoformat(),
        ultimoAcesso=get_now_brt().isoformat(), pontosTotais=1 
    )
    await db.usuarios.insert_one(usuario.dict())
    
    if user_data.equipeId:
        await db.equipes.update_one({"id": user_data.equipeId}, {"$inc": {"pontosTotais": 1}})
        
    access_token = create_access_token(data={"sub": usuario.id})
    user_dict = usuario.dict()
    del user_dict['senha']
    return Token(access_token=access_token, token_type="bearer", usuario=user_dict)

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UsuarioLogin):
    user = await db.usuarios.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.senha, user["senha"]): raise HTTPException(status_code=401, detail="Email ou senha incorretos")
    
    ativo_val = user.get("ativo", True)
    if isinstance(ativo_val, str): ativo = ativo_val.lower() in ['true', '1', 't', 'y', 'yes']
    else: ativo = bool(ativo_val)
        
    if not ativo: raise HTTPException(status_code=401, detail="Usuário desativado")
    
    user = await registrar_ponto_diario(user)
    
    access_token = create_access_token(data={"sub": user["id"]})
    return Token(access_token=access_token, token_type="bearer", usuario={k: v for k, v in user.items() if k not in ['senha', '_id']})

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    current_user = await registrar_ponto_diario(current_user)
    return {k: v for k, v in current_user.items() if k not in ['senha', '_id']}

@api_router.put("/auth/me")
async def update_me(update_data: dict, current_user: dict = Depends(get_current_user)):
    allowed = ["turmaId", "equipeId"]
    update_dict = {k: v for k, v in update_data.items() if k in allowed}
    if update_dict: await db.usuarios.update_one({"id": current_user["id"]}, {"$set": update_dict})
    u = await db.usuarios.find_one({"id": current_user["id"]})
    return {k: v for k, v in u.items() if k not in ['senha', '_id']}

@api_router.get("/turmas")
async def get_turmas():
    turmas = await db.turmas.find({}).to_list(100)
    return [{k: v for k, v in t.items() if k != '_id'} for t in turmas]

@api_router.post("/turmas")
async def create_turma(turma_data: dict, current_user: dict = Depends(require_admin)):
    turma = Turma(**turma_data)
    await db.turmas.insert_one(turma.dict())
    return turma.dict()

@api_router.delete("/turmas/{turma_id}")
async def delete_turma(turma_id: str, current_user: dict = Depends(require_admin)):
    await db.turmas.update_one({"id": turma_id}, {"$set": {"ativa": False}})
    return {"message": "Desativada"}

@api_router.get("/equipes")
async def get_equipes(turmaId: Optional[str] = None):
    query = {}
    if turmaId: query["turmaId"] = turmaId
    equipes = await db.equipes.find(query).to_list(100)
    return [{k: v for k, v in e.items() if k != '_id'} for e in equipes]

@api_router.post("/equipes")
async def create_equipe(equipe_data: dict, current_user: dict = Depends(require_admin)):
    equipe = Equipe(**equipe_data)
    await db.equipes.insert_one(equipe.dict())
    return equipe.dict()

@api_router.put("/equipes/{equipe_id}")
async def update_equipe(equipe_id: str, update_data: EquipeUpdate, current_user: dict = Depends(require_admin)):
    update_dict = update_data.dict(exclude_unset=True)
    if update_dict: await db.equipes.update_one({"id": equipe_id}, {"$set": update_dict})
    equipe = await db.equipes.find_one({"id": equipe_id})
    return {k: v for k, v in equipe.items() if k != '_id'}

@api_router.delete("/equipes/{equipe_id}")
async def delete_equipe(equipe_id: str, current_user: dict = Depends(require_admin)):
    await db.equipes.update_one({"id": equipe_id}, {"$set": {"ativa": False}})
    return {"message": "Equipe desativada"}

# ============== REINO (vila/progresso visual da equipe) ==============
@api_router.get("/reino/{equipe_id}")
async def get_reino(equipe_id: str, current_user: dict = Depends(get_current_user)):
    reino = await db.reinos.find_one({"equipeId": equipe_id})
    if not reino:
        castelo = Construcao(tipo="CASTELO", slot=0, nivel=1)
        novo_reino = Reino(equipeId=equipe_id, moedas=0, construcoes=[castelo])
        await db.reinos.insert_one(novo_reino.dict())
        reino = novo_reino.dict()
    reino_limpo = {k: v for k, v in reino.items() if k != '_id'}
    reino_limpo["slotsDisponiveis"] = calcular_slots_disponiveis(reino_limpo["construcoes"])
    return reino_limpo

@api_router.post("/reino/{equipe_id}/construir")
async def construir_reino(equipe_id: str, dados: ReinoConstruirRequest, current_user: dict = Depends(get_current_user)):
    is_admin = current_user.get("perfil") == "ADMIN"
    if not is_admin and current_user.get("equipeId") != equipe_id:
        raise HTTPException(status_code=403, detail="Você só pode construir no reino da sua própria equipe")

    if dados.tipo not in CATALOGO_REINO or dados.tipo == "CASTELO":
        raise HTTPException(status_code=400, detail="Tipo de construção inválido")

    reino = await db.reinos.find_one({"equipeId": equipe_id})
    if not reino:
        raise HTTPException(status_code=404, detail="Reino não encontrado")

    construcoes = reino.get("construcoes", [])
    if any(c["slot"] == dados.slot for c in construcoes):
        raise HTTPException(status_code=400, detail="Terreno já ocupado")

    slots_disponiveis = calcular_slots_disponiveis(construcoes)
    if dados.slot < 0 or dados.slot >= slots_disponiveis:
        raise HTTPException(status_code=400, detail="Terreno fora dos limites do reino")

    custo = CATALOGO_REINO[dados.tipo]["custoBase"]
    moedas_atuais = reino.get("moedas", 0)
    if not is_admin:
        if moedas_atuais < custo:
            raise HTTPException(status_code=400, detail="Moedas insuficientes")
        moedas_atuais -= custo

    nova_construcao = Construcao(tipo=dados.tipo, slot=dados.slot, nivel=1)
    await db.reinos.update_one(
        {"equipeId": equipe_id},
        {"$push": {"construcoes": nova_construcao.dict()}, "$set": {"moedas": moedas_atuais}}
    )
    reino_atualizado = await db.reinos.find_one({"equipeId": equipe_id})
    reino_limpo = {k: v for k, v in reino_atualizado.items() if k != '_id'}
    reino_limpo["slotsDisponiveis"] = calcular_slots_disponiveis(reino_limpo["construcoes"])
    return reino_limpo

@api_router.post("/reino/{equipe_id}/upgrade")
async def upgrade_reino(equipe_id: str, dados: ReinoUpgradeRequest, current_user: dict = Depends(get_current_user)):
    is_admin = current_user.get("perfil") == "ADMIN"
    if not is_admin and current_user.get("equipeId") != equipe_id:
        raise HTTPException(status_code=403, detail="Você só pode evoluir o reino da sua própria equipe")

    reino = await db.reinos.find_one({"equipeId": equipe_id})
    if not reino:
        raise HTTPException(status_code=404, detail="Reino não encontrado")

    construcoes = reino.get("construcoes", [])
    construcao = next((c for c in construcoes if c["id"] == dados.construcaoId), None)
    if not construcao:
        raise HTTPException(status_code=404, detail="Construção não encontrada")

    catalogo_item = CATALOGO_REINO[construcao["tipo"]]
    if construcao["nivel"] >= catalogo_item["nivelMax"]:
        raise HTTPException(status_code=400, detail="Construção já está no nível máximo")

    custo = catalogo_item["custoUpgrade"] * construcao["nivel"]
    moedas_atuais = reino.get("moedas", 0)
    if not is_admin:
        if moedas_atuais < custo:
            raise HTTPException(status_code=400, detail="Moedas insuficientes")
        moedas_atuais -= custo

    await db.reinos.update_one(
        {"equipeId": equipe_id, "construcoes.id": dados.construcaoId},
        {"$inc": {"construcoes.$.nivel": 1}, "$set": {"moedas": moedas_atuais}}
    )
    reino_atualizado = await db.reinos.find_one({"equipeId": equipe_id})
    reino_limpo = {k: v for k, v in reino_atualizado.items() if k != '_id'}
    reino_limpo["slotsDisponiveis"] = calcular_slots_disponiveis(reino_limpo["construcoes"])
    return reino_limpo

@api_router.get("/usuarios")
async def get_usuarios(current_user: dict = Depends(get_current_user)):
    usuarios_brutos = await db.usuarios.find({}).to_list(5000)
    usuarios_ativos = []
    is_admin = current_user.get("perfil") == "ADMIN"
    
    for u in usuarios_brutos:
        ativo_val = u.get("ativo", True)
        ativo = ativo_val.lower() in ['true', '1', 't', 'y', 'yes'] if isinstance(ativo_val, str) else bool(ativo_val)
        oculto = bool(u.get("ocultoChat", False))
        
        if ativo:
            if not is_admin and oculto:
                continue
            usuarios_ativos.append({k: v for k, v in u.items() if k not in ['senha', '_id']})
    return usuarios_ativos

@api_router.put("/usuarios/{user_id}")
async def admin_update_usuario(user_id: str, update_data: AdminUsuarioUpdate, current_user: dict = Depends(require_admin)):
    update_dict = update_data.dict(exclude_unset=True)
    if "senha" in update_dict:
        if update_dict["senha"]: update_dict["senha"] = get_password_hash(update_dict["senha"])
        else: del update_dict["senha"]
    if update_dict: await db.usuarios.update_one({"id": user_id}, {"$set": update_dict})
    updated_user = await db.usuarios.find_one({"id": user_id})
    return {k: v for k, v in updated_user.items() if k not in ['senha', '_id']}

@api_router.delete("/usuarios/{user_id}")
async def admin_delete_usuario(user_id: str, current_user: dict = Depends(require_admin)):
    await db.usuarios.update_one({"id": user_id}, {"$set": {"ativo": False}})
    return {"message": "Usuário desativado"}

@api_router.post("/usuarios/zerar-pontos")
async def zerar_todos_pontos(current_user: dict = Depends(require_admin)):
    await db.usuarios.update_many({}, {"$set": {"pontosTotais": 0, "recordeJogoSingle": 0, "recordeJogoMulti": 0, "recordeMathBlaster": 0}})
    await db.equipes.update_many({}, {"$set": {"pontosTotais": 0}})
    return {"message": "Todos os pontos e recordes foram zerados com sucesso."}

@api_router.get("/exercicios")
async def get_exercicios(turmaId: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {"ativo": True, "is_deleted": {"$ne": True}}
    if turmaId: query["$or"] = [{"turmaId": turmaId}, {"turmaId": None}]
    if current_user.get("perfil") == "ADMIN": query = {"ativo": True, "is_deleted": {"$ne": True}}
    exercicios = await db.exercicios.find(query).to_list(1000)
    return [{k: v for k, v in e.items() if k != '_id'} for e in exercicios]

@api_router.get("/exercicios/{exercicio_id}")
async def get_exercicio(exercicio_id: str, current_user: dict = Depends(get_current_user)):
    exercicio = await db.exercicios.find_one({"id": exercicio_id})
    if not exercicio: raise HTTPException(status_code=404, detail="Exercício não encontrado")
    questoes = await db.questoes.find({"exercicioId": exercicio_id}).sort("numero", 1).to_list(100)
    result = {k: v for k, v in exercicio.items() if k != '_id'}
    result["questoes"] = [{k: v for k, v in q.items() if k != '_id'} for q in questoes]
    return result

@api_router.post("/exercicios")
async def create_exercicio(exercicio_data: ExercicioCreate, current_user: dict = Depends(require_admin)):
    exercicio = Exercicio(**exercicio_data.dict(exclude={'questoes'}))
    await db.exercicios.insert_one(exercicio.dict())
    for q_data in exercicio_data.questoes:
        alternativas = [Alternativa(**a) for a in q_data.alternativas]
        questao = Questao(
            exercicioId=exercicio.id, numero=q_data.numero, tipoResposta=q_data.tipoResposta,
            enunciado=q_data.enunciado, imagemBase64=q_data.imagemBase64, alternativas=alternativas,
            correta=q_data.correta, pontuacaoMax=q_data.pontuacaoMax, habilidadesBNCC=q_data.habilidadesBNCC
        )
        await db.questoes.insert_one(questao.dict())
    return exercicio.dict()

@api_router.put("/exercicios/{exercicio_id}")
async def update_exercicio(exercicio_id: str, exercicio_data: ExercicioUpdate, current_user: dict = Depends(require_admin)):
    update_data = exercicio_data.dict(exclude={'questoes'})
    await db.exercicios.update_one({"id": exercicio_id}, {"$set": update_data})
    if exercicio_data.questoes is not None:
        await db.questoes.delete_many({"exercicioId": exercicio_id})
        for q_data in exercicio_data.questoes:
            alternativas = [Alternativa(**a) for a in q_data.alternativas]
            questao = Questao(
                exercicioId=exercicio_id, numero=q_data.numero, tipoResposta=q_data.tipoResposta,
                enunciado=q_data.enunciado, imagemBase64=q_data.imagemBase64, alternativas=alternativas,
                correta=q_data.correta, pontuacaoMax=q_data.pontuacaoMax, habilidadesBNCC=q_data.habilidadesBNCC
            )
            await db.questoes.insert_one(questao.dict())
    exercicio = await db.exercicios.find_one({"id": exercicio_id})
    return {k: v for k, v in exercicio.items() if k != '_id'}

@api_router.delete("/exercicios/{exercicio_id}")
async def delete_exercicio(exercicio_id: str, current_user: dict = Depends(require_admin)):
    await db.exercicios.update_one({"id": exercicio_id}, {"$set": {"is_deleted": True, "deleted_at": get_now_brt().isoformat()}})
    return {"message": "Exercício movido para a lixeira"}

@api_router.post("/submissoes")
async def create_submissao(submissao_data: SubmissaoCreate, current_user: dict = Depends(get_current_user)):
    exercicio = await db.exercicios.find_one({"id": submissao_data.exercicioId})
    if not exercicio: raise HTTPException(status_code=404, detail="Exercício não encontrado")
    questoes = await db.questoes.find({"exercicioId": submissao_data.exercicioId}).to_list(100)
    
    questoes_map = {q["id"]: q for q in questoes}
    acertos, erros = 0, 0
    detalhes = []
    
    for resp in submissao_data.respostas:
        questao = questoes_map.get(resp.questaoId)
        if not questao: continue
        correto = resp.resposta.upper().strip() == questao.get("correta", "").upper().strip()
        if correto: acertos += 1
        else: erros += 1
        habs = questao.get("habilidadesBNCC", [])
        if not habs: habs = exercicio.get("habilidadesBNCC", [])
        detalhes.append({
            "questaoId": resp.questaoId, "numero": questao.get("numero"),
            "resposta": resp.resposta, "correta": questao.get("correta"),
            "acertou": correto, "habilidadesBNCC": habs
        })
    
    total = len(questoes)
    nota = (acertos / total * 10) if total > 0 else 0
    pontos = int(acertos * exercicio.get("pontosPorQuestao", 1.0))
    
    submissao = Submissao(
        exercicioId=submissao_data.exercicioId, usuarioId=current_user["id"],
        respostas=[{"questaoId": r.questaoId, "resposta": r.resposta} for r in submissao_data.respostas],
        acertos=acertos, erros=erros, nota=round(nota, 1), pontosGerados=pontos,
        detalhesQuestoes=detalhes, ignorarNoRelatorioBNCC=False,
        data=get_now_brt().isoformat()
    )
    await db.submissoes.insert_one(submissao.dict())
    await db.usuarios.update_one({"id": current_user["id"]}, {"$inc": {"pontosTotais": pontos}})
    
    eq_raw = current_user.get("equipeId")
    if eq_raw: await db.equipes.update_one({"id": str(eq_raw).strip()}, {"$inc": {"pontosTotais": pontos}})
    
    return {"submissao": {k: v for k, v in submissao.dict().items() if k != '_id'}, "acertos": acertos, "erros": erros, "totalQuestoes": total, "nota": round(nota, 1), "pontosGerados": pontos}

@api_router.get("/submissoes/{exercicio_id}")
async def get_submissao(exercicio_id: str, current_user: dict = Depends(get_current_user)):
    sub = await db.submissoes.find_one({"exercicioId": exercicio_id, "usuarioId": current_user["id"]})
    return {k: v for k, v in sub.items() if k != '_id'} if sub else None

@api_router.delete("/submissoes/{exercicio_id}/retry")
async def retry_submissao(exercicio_id: str, current_user: dict = Depends(get_current_user)):
    sub = await db.submissoes.find_one({"exercicioId": exercicio_id, "usuarioId": current_user["id"]})
    if sub:
        pontos = sub.get("pontosGerados", 0)
        if pontos > 0:
            await db.usuarios.update_one({"id": current_user["id"]}, {"$inc": {"pontosTotais": -pontos}})
            eq_raw = current_user.get("equipeId")
            if eq_raw: await db.equipes.update_one({"id": str(eq_raw).strip()}, {"$inc": {"pontosTotais": -pontos}})
        await db.submissoes.delete_one({"_id": sub["_id"]})
    return {"message": "Pronto para tentar novamente"}

@api_router.get("/conteudos")
async def get_conteudos(categoria: Optional[str] = None, turmaId: Optional[str] = None):
    query = {"ativo": True, "is_deleted": {"$ne": True}}
    if categoria: query["abaCategoria"] = categoria
    if turmaId: query["$or"] = [{"turmaId": turmaId}, {"turmaId": None}]
    conteudos = await db.conteudos.find(query).sort("ordem", 1).to_list(1000)
    return [{k: v for k, v in c.items() if k != '_id'} for c in conteudos]

@api_router.get("/pastas")
async def get_pastas(turmaId: Optional[str] = None):
    query = {"ativo": True, "is_deleted": {"$ne": True}}
    if turmaId: query["$or"] = [{"turmaId": turmaId}, {"turmaId": None}]
    conteudos = await db.conteudos.find(query).to_list(1000)
    pastas = set()
    for c in conteudos:
        p = c.get("pasta")
        if p and str(p).strip(): pastas.add(str(p).strip())
    return sorted(list(pastas))

@api_router.post("/conteudos")
async def create_conteudo(conteudo_data: ConteudoCreate, current_user: dict = Depends(require_admin)):
    conteudo = Conteudo(**conteudo_data.dict())
    await db.conteudos.insert_one(conteudo.dict())
    return conteudo.dict()

@api_router.put("/conteudos/{conteudo_id}")
async def update_conteudo(conteudo_id: str, conteudo_data: dict, current_user: dict = Depends(require_admin)):
    await db.conteudos.update_one({"id": conteudo_id}, {"$set": conteudo_data})
    conteudo = await db.conteudos.find_one({"id": conteudo_id})
    return {k: v for k, v in conteudo.items() if k != '_id'}

@api_router.delete("/conteudos/{conteudo_id}")
async def delete_conteudo(conteudo_id: str, current_user: dict = Depends(require_admin)):
    await db.conteudos.update_one({"id": conteudo_id}, {"$set": {"is_deleted": True, "deleted_at": get_now_brt().isoformat()}})
    return {"message": "Conteúdo movido para a lixeira"}

@api_router.post("/conteudos/{conteudo_id}/concluir")
async def concluir_conteudo(conteudo_id: str, current_user: dict = Depends(get_current_user)):
    conteudo = await db.conteudos.find_one({"id": conteudo_id})
    if not conteudo: raise HTTPException(status_code=404, detail="Conteúdo não encontrado")
    ja_concluiu = await db.conteudos_concluidos.find_one({"usuarioId": current_user["id"], "conteudoId": conteudo_id})
    if ja_concluiu: return {"message": "Conteúdo já estava concluído", "pontos": 0}
    
    await db.conteudos_concluidos.insert_one({"usuarioId": current_user["id"], "conteudoId": conteudo_id, "data": get_now_brt().isoformat()})
    pontos = conteudo.get("pontos", 0)
    if pontos > 0:
        await db.usuarios.update_one({"id": current_user["id"]}, {"$inc": {"pontosTotais": pontos}})
        eq_raw = current_user.get("equipeId")
        if eq_raw: await db.equipes.update_one({"id": str(eq_raw).strip()}, {"$inc": {"pontosTotais": pontos}})
    return {"message": "Conteúdo concluído com sucesso", "pontos": pontos}

@api_router.get("/relatorios/geral")
async def get_relatorio_geral(current_user: dict = Depends(require_admin)):
    total_u = await db.usuarios.count_documents({"ativo": True})
    exercicios_ativos = await db.exercicios.find({"is_deleted": {"$ne": True}}).to_list(10000)
    total_e = len(exercicios_ativos)
    ids_ativos = [e["id"] for e in exercicios_ativos]
    submissoes_exercicios = await db.submissoes.find({"exercicioId": {"$in": ids_ativos}, "ignorarNoRelatorioBNCC": {"$ne": True}}).to_list(10000)
    videos_e_docs_concluidos = await db.conteudos_concluidos.count_documents({})
    total_s = len(submissoes_exercicios) + videos_e_docs_concluidos
    notas_por_aluno = {}
    for sub in submissoes_exercicios:
        uid = sub.get("usuarioId")
        nota = float(sub.get("nota", 0.0))
        if uid not in notas_por_aluno: notas_por_aluno[uid] = []
        notas_por_aluno[uid].append(nota)
    medias_alunos = [sum(n) / len(n) for n in notas_por_aluno.values() if len(n) > 0]
    media_geral = sum(medias_alunos) / len(medias_alunos) if len(medias_alunos) > 0 else 0.0
    return { "totalUsuarios": total_u, "totalExercicios": total_e, "totalSubmissoes": total_s, "mediaGeral": round(media_geral, 1) }

@api_router.get("/relatorios/bncc")
async def get_relatorio_bncc(filtro_tipo: str = "GERAL", turma_id: Optional[str] = None, equipe_id: Optional[str] = None, current_user: dict = Depends(require_admin)):
    submissoes = await db.submissoes.find({"ignorarNoRelatorioBNCC": {"$ne": True}}).to_list(10000)
    usuarios = {u["id"]: u for u in await db.usuarios.find({}).to_list(5000)}
    turmas = {str(t.get("id", t.get("_id"))): t for t in await db.turmas.find({}).to_list(100)}
    exercicios_dict = {str(e.get("id", e.get("_id"))): e for e in await db.exercicios.find({}).to_list(10000)}
    max_grade = 99
    if filtro_tipo in ["TURMA", "EQUIPE_TURMA"] and turma_id:
        turma = turmas.get(turma_id)
        if turma: max_grade = parse_turma_grade(turma.get("nome", ""))
    bncc_stats = {} 
    for sub in submissoes:
        user = usuarios.get(sub.get("usuarioId"))
        if not user: continue
        u_turma = str(user.get("turmaId", ""))
        u_equipe = str(user.get("equipeId", ""))
        if filtro_tipo == "TURMA" and u_turma != turma_id: continue
        if filtro_tipo == "EQUIPE" and u_equipe != equipe_id: continue
        if filtro_tipo == "EQUIPE_TURMA" and (u_turma != turma_id or u_equipe != equipe_id): continue
        for det in sub.get("detalhesQuestoes", []):
            habilidades = det.get("habilidadesBNCC", [])
            if not habilidades:
                ex = exercicios_dict.get(sub.get("exercicioId"))
                if ex: habilidades = ex.get("habilidadesBNCC", [])
            acertou = det.get("acertou", False)
            for hab in habilidades:
                if not hab: continue
                if filtro_tipo in ["TURMA", "EQUIPE_TURMA"] and get_bncc_grade(hab) > max_grade: continue
                if hab not in bncc_stats: bncc_stats[hab] = {"habilidade": hab, "acertos": 0, "erros": 0, "total": 0}
                if acertou: bncc_stats[hab]["acertos"] += 1
                else: bncc_stats[hab]["erros"] += 1
                bncc_stats[hab]["total"] += 1
    return list(bncc_stats.values())

class LimparRelatorioRequest(BaseModel):
    tipo: str  
    alvoId: Optional[str] = None

@api_router.post("/relatorios/bncc/limpar")
async def limpar_relatorio_bncc(req: LimparRelatorioRequest, current_user: dict = Depends(require_admin)):
    query = {}
    if req.tipo == "TURMA" and req.alvoId:
        usuarios = await db.usuarios.find({"turmaId": req.alvoId}).to_list(5000)
        query = {"usuarioId": {"$in": [u["id"] for u in usuarios]}}
    elif req.tipo == "USUARIO" and req.alvoId: query = {"usuarioId": req.alvoId}
    elif req.tipo == "TUDO": query = {}
    else: raise HTTPException(status_code=400, detail="Filtro inválido")
    result = await db.submissoes.update_many(query, {"$set": {"ignorarNoRelatorioBNCC": True}})
    return {"message": f"Dados ocultados. {result.modified_count} registros arquivados com sucesso."}

@api_router.get("/admin/lixeira")
async def get_lixeira(current_user: dict = Depends(require_admin)):
    exs = await db.exercicios.find({"is_deleted": True}).to_list(100)
    return [{"id": e["id"], "titulo": e["titulo"], "tipo": "EXERCICIO", "deleted_at": e.get("deleted_at")} for e in exs]

@api_router.post("/admin/lixeira/{item_id}/restaurar")
async def restaurar_item(item_id: str, tipo: str, current_user: dict = Depends(require_admin)):
    if tipo == "EXERCICIO":
        await db.exercicios.update_one({"id": item_id}, {"$set": {"is_deleted": False}})
        return {"message": "Restaurado"}
    raise HTTPException(400, "Tipo inválido")

@api_router.delete("/admin/lixeira/{item_id}")
async def delete_permanente(item_id: str, tipo: str, current_user: dict = Depends(require_admin)):
    if tipo == "EXERCICIO":
        await db.exercicios.delete_one({"id": item_id})
        await db.questoes.delete_many({"exercicioId": item_id})
        return {"message": "Deletado"}
    raise HTTPException(400, "Tipo inválido")

# =====================================================================
# ROTAS DO CHAT PRIVADO E MODERAÇÃO
# =====================================================================
@api_router.get("/chat/inbox")
async def obter_resumo_inbox(current_user: dict = Depends(get_current_user)):
    mensagens = await db.mensagens_privadas.find({
        "$or": [
            {"remetenteId": current_user["id"]},
            {"destinatarioId": current_user["id"]}
        ]
    }).to_list(10000)

    inbox = {}
    for m in mensagens:
        if m.get("apagadaPorAdmin"): continue
        other_id = m["destinatarioId"] if m["remetenteId"] == current_user["id"] else m["remetenteId"]
        
        if other_id not in inbox:
            inbox[other_id] = {"unreadCount": 0, "lastMessageTime": m["criadoEm"]}
        
        if m["criadoEm"] > inbox[other_id]["lastMessageTime"]:
            inbox[other_id]["lastMessageTime"] = m["criadoEm"]
        
        if m["destinatarioId"] == current_user["id"] and not m.get("lida"):
            inbox[other_id]["unreadCount"] += 1
            
    return inbox

@api_router.post("/chat/mensagens")
async def enviar_mensagem(dados: MensagemPrivadaCreate, current_user: dict = Depends(get_current_user)):
    bloqueio = await db.bloqueios_chat.find_one({
        "$or": [
            {"usuarioId1": current_user["id"], "usuarioId2": dados.destinatarioId},
            {"usuarioId1": dados.destinatarioId, "usuarioId2": current_user["id"]}
        ]
    })
    if bloqueio and bloqueio.get("bloqueadoPorAdmin"):
        raise HTTPException(status_code=403, detail="Esta conversa foi bloqueada pela moderação.")

    msg = {
        "id": str(uuid.uuid4()),
        "remetenteId": current_user["id"],
        "destinatarioId": dados.destinatarioId,
        "texto": dados.texto,
        "lida": False,
        "apagadaPorAdmin": False,
        "editadaPorAdmin": False,
        "criadoEm": get_now_brt().isoformat()
    }
    await db.mensagens_privadas.insert_one(msg)
    return {"message": "Mensagem enviada com sucesso", "dados": {k: v for k, v in msg.items() if k != '_id'}}

@api_router.get("/chat/mensagens/{other_user_id}")
async def obter_conversa(other_user_id: str, current_user: dict = Depends(get_current_user)):
    mensagens = await db.mensagens_privadas.find({
        "$or": [
            {"remetenteId": current_user["id"], "destinatarioId": other_user_id},
            {"remetenteId": other_user_id, "destinatarioId": current_user["id"]}
        ]
    }).sort("criadoEm", 1).to_list(500)

    ids_nao_lidas = [m["id"] for m in mensagens if m["destinatarioId"] == current_user["id"] and not m.get("lida")]
    if ids_nao_lidas:
        await db.mensagens_privadas.update_many({"id": {"$in": ids_nao_lidas}}, {"$set": {"lida": True}})

    return [{k: v for k, v in m.items() if k != '_id'} for m in mensagens if not m.get("apagadaPorAdmin")]

@api_router.get("/admin/chat/inbox/{alvo_id}")
async def admin_obter_resumo_inbox(alvo_id: str, current_user: dict = Depends(require_admin)):
    mensagens = await db.mensagens_privadas.find({
        "$or": [{"remetenteId": alvo_id}, {"destinatarioId": alvo_id}]
    }).to_list(10000)
    inbox = {}
    for m in mensagens:
        other_id = m["destinatarioId"] if m["remetenteId"] == alvo_id else m["remetenteId"]
        if other_id not in inbox:
            inbox[other_id] = {"lastMessageTime": m["criadoEm"]}
        if m["criadoEm"] > inbox[other_id]["lastMessageTime"]:
            inbox[other_id]["lastMessageTime"] = m["criadoEm"]
    return inbox

@api_router.get("/admin/chat/mensagens/{user1}/{user2}")
async def admin_obter_conversa(user1: str, user2: str, current_user: dict = Depends(require_admin)):
    mensagens = await db.mensagens_privadas.find({
        "$or": [
            {"remetenteId": user1, "destinatarioId": user2},
            {"remetenteId": user2, "destinatarioId": user1}
        ]
    }).sort("criadoEm", 1).to_list(1000)
    return [{k: v for k, v in m.items() if k != '_id'} for m in mensagens]

class MensagemEdit(BaseModel):
    texto: str

@api_router.put("/admin/chat/mensagens/{msg_id}")
async def admin_editar_mensagem(msg_id: str, dados: MensagemEdit, current_user: dict = Depends(require_admin)):
    await db.mensagens_privadas.update_one({"id": msg_id}, {"$set": {"texto": dados.texto, "editadaPorAdmin": True}})
    return {"message": "Mensagem editada"}

@api_router.get("/admin/chat/mensagens")
async def admin_obter_todas_mensagens(current_user: dict = Depends(require_admin)):
    mensagens = await db.mensagens_privadas.find({}).sort("criadoEm", -1).to_list(2000)
    return [{k: v for k, v in m.items() if k != '_id'} for m in mensagens]

@api_router.delete("/admin/chat/mensagens/{msg_id}")
async def admin_apagar_mensagem(msg_id: str, current_user: dict = Depends(require_admin)):
    await db.mensagens_privadas.update_one({"id": msg_id}, {"$set": {"apagadaPorAdmin": True, "texto": "[Mensagem removida]"}})
    return {"message": "Mensagem apagada"}

@api_router.post("/admin/chat/bloquear")
async def admin_bloquear_conversa(dados: BloqueioChatCreate, current_user: dict = Depends(require_admin)):
    existente = await db.bloqueios_chat.find_one({ "$or": [ {"usuarioId1": dados.usuarioId1, "usuarioId2": dados.usuarioId2}, {"usuarioId1": dados.usuarioId2, "usuarioId2": dados.usuarioId1} ] })
    if existente: await db.bloqueios_chat.update_one({"_id": existente["_id"]}, {"$set": {"bloqueadoPorAdmin": True}})
    else: await db.bloqueios_chat.insert_one({"id": str(uuid.uuid4()), "usuarioId1": dados.usuarioId1, "usuarioId2": dados.usuarioId2, "bloqueadoPorAdmin": True})
    return {"message": "Bloqueada"}

@api_router.post("/admin/chat/desbloquear")
async def admin_desbloquear_conversa(dados: BloqueioChatCreate, current_user: dict = Depends(require_admin)):
    await db.bloqueios_chat.update_many({ "$or": [ {"usuarioId1": dados.usuarioId1, "usuarioId2": dados.usuarioId2}, {"usuarioId1": dados.usuarioId2, "usuarioId2": dados.usuarioId1} ] }, {"$set": {"bloqueadoPorAdmin": False}})
    return {"message": "Desbloqueada"}

# =====================================================================
# ROTAS DO RANKING E OUTRAS
# =====================================================================
@api_router.get("/ranking/geral")
async def get_ranking_geral():
    equipes = await db.equipes.find({}).to_list(100)
    pontos_por_equipe = {str(e.get("id", e.get("_id", ""))).strip().lower(): 0 for e in equipes}
    for aluno in await db.usuarios.find({}).to_list(5000):
        perfil = str(aluno.get("perfil") or "ALUNO").strip().upper()
        ativo_val = aluno.get("ativo", True)
        ativo = ativo_val.lower() in ['true', '1', 't', 'y', 'yes'] if isinstance(ativo_val, str) else bool(ativo_val)
        if perfil in ["ALUNO", "ALUNO_LIDER"] and ativo:
            eq_id_clean = str(aluno.get("equipeId") or "").strip().lower()
            try: pts = int(float(aluno.get("pontosTotais", 0)))
            except: pts = 0
            if eq_id_clean in pontos_por_equipe: pontos_por_equipe[eq_id_clean] += pts
            else:
                for e in equipes:
                    if eq_id_clean == str(e.get("nome", "")).strip().lower():
                        e_id_real = str(e.get("id", e.get("_id", ""))).strip().lower()
                        if e_id_real in pontos_por_equipe: pontos_por_equipe[e_id_real] += pts
                        break
    equipes_ranking = []
    for e in equipes:
        e_id_clean = str(e.get("id", e.get("_id", ""))).strip().lower()
        pts_reais = pontos_por_equipe.get(e_id_clean, 0)
        if e.get("pontosTotais", 0) != pts_reais:
            query_id = e.get("id")
            if query_id: await db.equipes.update_one({"id": query_id}, {"$set": {"pontosTotais": pts_reais}})
            else: await db.equipes.update_one({"_id": e["_id"]}, {"$set": {"pontosTotais": pts_reais}})
        equipes_ranking.append({"id": str(e.get("id", "")), "nome": e.get("nome", "Sem Nome"), "cor": e.get("cor", "#333"), "pontosTotais": pts_reais})
    equipes_ranking.sort(key=lambda x: x["pontosTotais"], reverse=True)
    for i, e in enumerate(equipes_ranking): e["posicao"] = i + 1
    return equipes_ranking

@api_router.get("/ranking/turma/{turma_id}")
async def get_ranking_turma(turma_id: str):
    equipes = await db.equipes.find({}).to_list(100)
    pontos_por_equipe = {str(e.get("id", e.get("_id", ""))).strip().lower(): 0 for e in equipes}
    turma_alvo_limpa = str(turma_id).strip().lower()
    turma_obj = await db.turmas.find_one({"id": turma_id})
    turma_nome_limpo = str(turma_obj.get("nome", "")).strip().lower() if turma_obj else ""
    for aluno in await db.usuarios.find({}).to_list(5000):
        perfil = str(aluno.get("perfil") or "ALUNO").strip().upper()
        ativo_val = aluno.get("ativo", True)
        ativo = ativo_val.lower() in ['true', '1', 't', 'y', 'yes'] if isinstance(ativo_val, str) else bool(ativo_val)
        if perfil in ["ALUNO", "ALUNO_LIDER"] and ativo:
            aluno_turma = str(aluno.get("turmaId") or "").strip().lower()
            if aluno_turma == turma_alvo_limpa or (turma_nome_limpo and aluno_turma == turma_nome_limpo):
                eq_id_clean = str(aluno.get("equipeId") or "").strip().lower()
                try: pts = int(float(aluno.get("pontosTotais", 0)))
                except: pts = 0
                if eq_id_clean in pontos_por_equipe: pontos_por_equipe[eq_id_clean] += pts
                else:
                    for e in equipes:
                        if eq_id_clean == str(e.get("nome", "")).strip().lower():
                            e_id_real = str(e.get("id", e.get("_id", ""))).strip().lower()
                            if e_id_real in pontos_por_equipe: pontos_por_equipe[e_id_real] += pts
                            break
    equipes_ranking = []
    for e in equipes:
        e_id_clean = str(e.get("id", e.get("_id", ""))).strip().lower()
        equipes_ranking.append({"id": str(e.get("id", "")), "nome": e.get("nome", "Sem Nome"), "cor": e.get("cor", "#333"), "pontosTotais": pontos_por_equipe.get(e_id_clean, 0)})
    equipes_ranking.sort(key=lambda x: x["pontosTotais"], reverse=True)
    for i, e in enumerate(equipes_ranking): e["posicao"] = i + 1
    return equipes_ranking

@api_router.post("/jogos/pontuar")
async def pontuar_jogo(dados: PontuacaoJogo, current_user: dict = Depends(get_current_user)):
    """Endpoint único usado por TODOS os jogos (arcade, math blaster, cabo
    de guerra, jogo da velha...) pra dar ponto de equipe, já respeitando o
    limite diário anti-inflação configurado em CONFIG_PONTOS_JOGOS."""
    if dados.pontos <= 0:
        return {"pontosGanhos": 0, "mensagem": "Nenhum ponto recebido"}
    jogo = dados.jogo.strip().lower()
    eq_id = current_user.get("equipeId")
    resultado = await aplicar_pontos_diarios_jogo(current_user["id"], eq_id, jogo, dados.pontos)
    return resultado

@api_router.post("/arcade/score")
async def submit_arcade_score(data: ArcadeScore, current_user: dict = Depends(get_current_user)):
    pontos_score = data.pontos
    if pontos_score <= 0: return {"message": "Nenhum ponto recebido"}
    current_record = current_user.get("recordeJogoSingle", 0)
    is_new_record = pontos_score > current_record
    if is_new_record: await db.usuarios.update_one({"id": current_user["id"]}, {"$set": {"recordeJogoSingle": pontos_score}})
    return {"message": "Score processado", "newRecord": is_new_record}

@api_router.get("/ranking/arcade")
async def get_ranking_arcade():
    usuarios = await db.usuarios.find({"ativo": True}).to_list(5000)
    equipes = {str(e.get("id", e.get("_id", ""))): e for e in await db.equipes.find({}).to_list(100)}
    turmas = {str(t.get("id", t.get("_id", ""))): t for t in await db.turmas.find({}).to_list(100)}
    ranking = []
    for u in usuarios:
        recorde = u.get("recordeJogoSingle", 0)
        is_admin = u.get("perfil") == "ADMIN"
        if is_admin:
            pontos_finais = recorde if recorde > 0 else 1
            ranking.append({"id": u["id"], "nome": u.get("nome", "Admin").split(" ")[0], "pontosMaximos": pontos_finais, "equipe": "", "cor": "#FFD700", "turma": "Professor", "isProf": True})
        elif recorde > 0:
            eq = equipes.get(str(u.get("equipeId", "")))
            turma = turmas.get(str(u.get("turmaId", "")))
            ranking.append({"id": u["id"], "nome": u.get("nome", "Estudante").split(" ")[0], "pontosMaximos": recorde, "equipe": eq.get("nome", "") if eq else "", "cor": eq.get("cor", "#888") if eq else "#888", "turma": turma.get("nome", "") if turma else "", "isProf": False})
    ranking.sort(key=lambda x: x["pontosMaximos"], reverse=True)
    for i, r in enumerate(ranking): r["posicao"] = i + 1
    return ranking

@api_router.post("/math_blaster/score")
async def submit_math_blaster_score(data: MathBlasterScore, current_user: dict = Depends(get_current_user)):
    pontos_score = data.pontos
    if pontos_score <= 0: return {"message": "Nenhum ponto recebido"}
    current_record = current_user.get("recordeMathBlaster", 0)
    is_new_record = pontos_score > current_record
    if is_new_record: 
        await db.usuarios.update_one({"id": current_user["id"]}, {"$set": {"recordeMathBlaster": pontos_score}})
    return {"message": "Score processado", "newRecord": is_new_record}

@api_router.get("/ranking/math_blaster")
async def get_ranking_math_blaster():
    usuarios = await db.usuarios.find({"ativo": True}).to_list(5000)
    equipes = {str(e.get("id", e.get("_id", ""))): e for e in await db.equipes.find({}).to_list(100)}
    turmas = {str(t.get("id", t.get("_id", ""))): t for t in await db.turmas.find({}).to_list(100)}
    ranking = []
    for u in usuarios:
        recorde = u.get("recordeMathBlaster", 0)
        is_admin = u.get("perfil") == "ADMIN"
        if is_admin:
            pontos_finais = recorde if recorde > 0 else 1
            ranking.append({"id": u["id"], "nome": u.get("nome", "Admin").split(" ")[0], "pontosMaximos": pontos_finais, "equipe": "", "cor": "#FFD700", "turma": "Professor", "isProf": True})
        elif recorde > 0:
            eq = equipes.get(str(u.get("equipeId", "")))
            turma = turmas.get(str(u.get("turmaId", "")))
            ranking.append({"id": u["id"], "nome": u.get("nome", "Estudante").split(" ")[0], "pontosMaximos": recorde, "equipe": eq.get("nome", "") if eq else "", "cor": eq.get("cor", "#888") if eq else "#888", "turma": turma.get("nome", "") if turma else "", "isProf": False})
    ranking.sort(key=lambda x: x["pontosMaximos"], reverse=True)
    for i, r in enumerate(ranking): r["posicao"] = i + 1
    return ranking

# =========================================================
# NOVAS ROTAS (Inimigo Raro e Premiação de Admin)
# =========================================================
@api_router.post("/math_blaster/rare_kill")
async def math_blaster_rare_kill(current_user: dict = Depends(get_current_user)):
    await db.usuarios.update_one({"id": current_user["id"]}, {"$inc": {"pontosTotais": 1}})
    eq_id = current_user.get("equipeId")
    if eq_id:
        await db.equipes.update_one({"id": str(eq_id).strip()}, {"$inc": {"pontosTotais": 1}})
    return {"message": "1 ponto de perfil adicionado ao jogador e equipe."}

@api_router.post("/admin/premiar_ranking")
async def admin_premiar_ranking(dados: PremiacaoRequest, current_user: dict = Depends(require_admin)):
    if dados.tipo == "ARCADE":
        usuarios = await db.usuarios.find({"ativo": True, "recordeJogoSingle": {"$gt": 0}}).to_list(5000)
        usuarios.sort(key=lambda x: x.get("recordeJogoSingle", 0), reverse=True)
    elif dados.tipo == "MATH_BLASTER":
        usuarios = await db.usuarios.find({"ativo": True, "recordeMathBlaster": {"$gt": 0}}).to_list(5000)
        usuarios.sort(key=lambda x: x.get("recordeMathBlaster", 0), reverse=True)
    else:
        raise HTTPException(status_code=400, detail="Tipo de ranking inválido")

    top_users = usuarios[:3]
    premios = [dados.pts1, dados.pts2, dados.pts3]
    
    for i, user in enumerate(top_users):
        pts = premios[i]
        if pts > 0:
            await db.usuarios.update_one({"id": user["id"]}, {"$inc": {"pontosTotais": pts}})
            eq_id = user.get("equipeId")
            if eq_id:
                await db.equipes.update_one({"id": str(eq_id).strip()}, {"$inc": {"pontosTotais": pts}})
                
    return {"message": "Premiação distribuída com sucesso."}

# =========================================================

@api_router.get("/usuarios/progresso")
async def get_meu_progresso(current_user: dict = Depends(get_current_user)):
    submissoes = await db.submissoes.find({"usuarioId": current_user["id"]}).sort("data", -1).to_list(100)
    concluidos = await db.conteudos_concluidos.find({"usuarioId": current_user["id"]}).to_list(1000)
    pontos_videos = 0
    if len(concluidos) > 0:
        conteudos_db = await db.conteudos.find({"id": {"$in": [c["conteudoId"] for c in concluidos]}}).to_list(1000)
        pontos_videos = sum(c.get("pontos", 0) for c in conteudos_db)
    return {
        "pontosTotais": current_user.get("pontosTotais", 0), "totalExercicios": len(submissoes),
        "pontosExercicios": sum(s.get("pontosGerados", 0) for s in submissoes),
        "totalVideos": len(concluidos), "pontosVideos": pontos_videos,
        "submissoes": [{k: v for k, v in s.items() if k != '_id'} for s in submissoes]
    }

@api_router.get("/missoes")
async def get_missoes(current_user: dict = Depends(require_admin)):
    missoes = await db.missoes.find({}).sort("criadoEm", -1).to_list(1000)
    return [{k: v for k, v in m.items() if k != '_id'} for m in missoes]

@api_router.post("/missoes")
async def create_missao(missao_data: MissaoCreate, current_user: dict = Depends(require_admin)):
    missao = Missao(**missao_data.dict())
    missao.criadaPor = current_user["id"]
    agora = get_now_brt()
    missao.criadoEm = agora.isoformat()
    missao.expiraEm = (agora + timedelta(hours=24)).isoformat() 
    await db.missoes.insert_one(missao.dict())
    return missao.dict()

@api_router.delete("/missoes/{missao_id}")
async def delete_missao(missao_id: str, current_user: dict = Depends(require_admin)):
    await db.missoes.delete_one({"id": missao_id})
    return {"message": "Missão deletada"}

@api_router.get("/missoes/disponiveis")
async def get_missoes_disponiveis(current_user: dict = Depends(get_current_user)):
    agora_iso = get_now_brt().isoformat()
    query = {
        "$and": [
            {"$or": [{"expiraEm": {"$gt": agora_iso}}, {"expiraEm": {"$exists": False}}]},
            {"$or": [
                {"alvoTipo": "GERAL"}, {"alvoTipo": "TURMA", "alvoId": current_user.get("turmaId")},
                {"alvoTipo": "EQUIPE", "alvoId": current_user.get("equipeId")}, {"alvoTipo": "INDIVIDUAL", "alvoId": current_user["id"]}
            ]}
        ]
    }
    missoes = await db.missoes.find(query).to_list(100)
    resultados = []
    for m in missoes:
        tentativas = await db.missoes_tentativas.count_documents({"usuarioId": current_user["id"], "missaoId": m["id"]})
        m_dict = {k: v for k, v in m.items() if k != '_id'}
        m_dict["tentativasFeitas"] = tentativas
        resultados.append(m_dict)
    return resultados

@api_router.post("/missoes/{missao_id}/tentativa")
async def registrar_tentativa(missao_id: str, current_user: dict = Depends(get_current_user)):
    missao = await db.missoes.find_one({"id": missao_id})
    if not missao: raise HTTPException(status_code=404, detail="Missão não encontrada")
    tentativas = await db.missoes_tentativas.count_documents({"usuarioId": current_user["id"], "missaoId": missao_id})
    limite = missao.get("limiteTentativas", 1)
    if limite > 0 and tentativas >= limite: raise HTTPException(status_code=400, detail="Limite alcançado")
    await db.missoes_tentativas.insert_one({"usuarioId": current_user["id"], "missaoId": missao_id, "data": get_now_brt().isoformat()})
    return {"message": "Tentativa registrada"}

@api_router.post("/missoes/{missao_id}/concluir")
async def concluir_missao(missao_id: str, current_user: dict = Depends(get_current_user)):
    missao = await db.missoes.find_one({"id": missao_id})
    if not missao: raise HTTPException(status_code=404, detail="Missão não encontrada")
    pontos = missao.get("recompensa", 0)
    await db.usuarios.update_one({"id": current_user["id"]}, {"$inc": {"pontosTotais": pontos}})
    eq_raw = current_user.get("equipeId")
    if eq_raw: await db.equipes.update_one({"id": str(eq_raw).strip()}, {"$inc": {"pontosTotais": pontos}})
    return {"message": "Missão concluída", "pontos": pontos}

# ===== SUDOKU =====
@api_router.get("/sudoku/sessao")
async def get_sudoku_sessao(current_user: dict = Depends(get_current_user)):
    sessao = await db.sudoku_sessoes.find_one({"usuarioId": current_user["id"]})
    if not sessao:
        return None
    return {k: v for k, v in sessao.items() if k != '_id'}

@api_router.put("/sudoku/sessao")
async def save_sudoku_sessao(sessao: SudokuSessao, current_user: dict = Depends(get_current_user)):
    doc = sessao.dict()
    doc["usuarioId"] = current_user["id"]
    await db.sudoku_sessoes.replace_one({"usuarioId": current_user["id"]}, doc, upsert=True)
    return {"message": "ok"}

@api_router.delete("/sudoku/sessao")
async def delete_sudoku_sessao(current_user: dict = Depends(get_current_user)):
    await db.sudoku_sessoes.delete_one({"usuarioId": current_user["id"]})
    return {"message": "ok"}

@api_router.post("/sudoku/concluir")
async def concluir_sudoku(dados: SudokuConclusao, current_user: dict = Depends(get_current_user)):
    doc = dados.dict()
    doc["usuarioId"] = current_user["id"]
    doc["concluidoEm"] = get_now_brt().isoformat()
    await db.sudoku_ranking.insert_one(doc)
    await db.sudoku_sessoes.delete_one({"usuarioId": current_user["id"]})
    return {"message": "ok"}

@api_router.get("/sudoku/ranking/{difficulty}")
async def get_sudoku_ranking(difficulty: str):
    resultados = await db.sudoku_ranking.find({"difficulty": difficulty}).sort("elapsedSeconds", 1).to_list(100)
    out = []
    for r in resultados:
        usuario = await db.usuarios.find_one({"id": r["usuarioId"]})
        out.append({
            "nome": usuario.get("nome", "?") if usuario else "?",
            "elapsedSeconds": r["elapsedSeconds"],
            "hintsUsed": r["hintsUsed"],
            "concluidoEm": r.get("concluidoEm"),
        })
    return out

# =========================================================================
# TRILHA DA TABUADA (método Leitner de repetição espaçada)
# -------------------------------------------------------------------------
# A matemática do método (níveis, revisões, seleção de cards) vive num
# módulo único e testado no app (frontend/src/services/leitner.ts). O
# backend guarda o estado dos cards e TODO o histórico de respostas, e
# calcula os relatórios/gráficos a partir desse histórico real.
# Coleções: db.tabuada_cards (1 doc por aluno+operação) e
#           db.tabuada_respostas (1 doc por resposta dada).
# =========================================================================
TABUADA_TOTAL_CARDS = 100  # 1..10 × 1..10 (7x8 e 8x7 são cards distintos)

def _tabuada_clamp_nivel(nivel: int) -> int:
    return max(1, min(5, int(nivel or 1)))

@api_router.get("/tabuada/cards")
async def get_tabuada_cards(current_user: dict = Depends(get_current_user)):
    cards = await db.tabuada_cards.find({"usuarioId": current_user["id"]}).to_list(300)
    return [{k: v for k, v in c.items() if k != '_id'} for c in cards]

@api_router.post("/tabuada/sessao")
async def registrar_tabuada_sessao(dados: TabuadaSessaoRequest, current_user: dict = Depends(get_current_user)):
    """Recebe o lote de respostas de uma sessão de treino: grava cada resposta
    no histórico e atualiza o estado (nível/próxima revisão) de cada card."""
    if not dados.respostas:
        return {"message": "Sessão vazia"}
    agora = get_now_brt().isoformat()
    sessao_id = str(uuid.uuid4())

    for r in dados.respostas:
        nivel_antes = _tabuada_clamp_nivel(r.nivelAntes)
        nivel_depois = _tabuada_clamp_nivel(r.nivelDepois)
        await db.tabuada_respostas.insert_one({
            "id": str(uuid.uuid4()),
            "sessaoId": sessao_id,
            "usuarioId": current_user["id"],
            "turmaId": current_user.get("turmaId"),
            "modulo": dados.modulo,
            "operacao": r.operacao,
            "fator1": r.fator1,
            "fator2": r.fator2,
            "respostaCorreta": r.respostaCorreta,
            "respostaDada": r.respostaDada,
            "acertou": r.acertou,
            "tempoResposta": r.tempoResposta,
            "nivelAntes": nivel_antes,
            "nivelDepois": nivel_depois,
            "proximaRevisao": r.proximaRevisao,
            "classificacao": r.classificacao,
            "respondidoEm": r.respondidoEm,
            "registradoEm": agora,
        })
        update: Dict[str, Any] = {
            "$set": {
                "nivel": nivel_depois,
                "proximaRevisao": r.proximaRevisao,
                "fator1": r.fator1,
                "fator2": r.fator2,
                "ultimaRespostaEm": agora,
            },
            "$inc": {"vezesVista": 1, "vezesErrada": 0 if r.acertou else 1},
            "$setOnInsert": {"id": str(uuid.uuid4()), "criadoEm": agora, "modulo": dados.modulo},
        }
        if not r.acertou:
            update["$set"]["ultimoErroEm"] = agora
        await db.tabuada_cards.update_one(
            {"usuarioId": current_user["id"], "operacao": r.operacao}, update, upsert=True
        )

    return {"message": "ok", "sessaoId": sessao_id, "respostasRegistradas": len(dados.respostas)}

# --- Jogos personalizados (agrupam flash cards por tema: "MMC", "Frações"...) ---
# Cada jogo é isolado dos demais e da Trilha da Tabuada principal: cards com
# jogoId preenchido só aparecem no treino daquele jogo específico.
@api_router.get("/tabuada/jogos")
async def get_tabuada_jogos(current_user: dict = Depends(get_current_user)):
    jogos = await db.tabuada_jogos_personalizados.find({"usuarioId": current_user["id"]}).sort("criadoEm", -1).to_list(200)
    resultado = []
    for j in jogos:
        qtd = await db.tabuada_flashcards_personalizados.count_documents({"jogoId": j["id"]})
        resultado.append({**{k: v for k, v in j.items() if k != '_id'}, "quantidadeCards": qtd})
    return resultado

@api_router.post("/tabuada/jogos")
async def criar_tabuada_jogo(dados: JogoPersonalizadoCreate, current_user: dict = Depends(get_current_user)):
    if not dados.nome.strip():
        raise HTTPException(status_code=400, detail="Dê um nome para o jogo")
    novo = {
        "id": str(uuid.uuid4()),
        "usuarioId": current_user["id"],
        "nome": dados.nome.strip(),
        "criadoEm": get_now_brt().isoformat(),
    }
    await db.tabuada_jogos_personalizados.insert_one(novo)
    return {**{k: v for k, v in novo.items() if k != '_id'}, "quantidadeCards": 0}

@api_router.delete("/tabuada/jogos/{jogo_id}")
async def deletar_tabuada_jogo(jogo_id: str, current_user: dict = Depends(get_current_user)):
    jogo = await db.tabuada_jogos_personalizados.find_one({"id": jogo_id, "usuarioId": current_user["id"]})
    if not jogo:
        raise HTTPException(status_code=404, detail="Jogo não encontrado")
    await db.tabuada_jogos_personalizados.delete_one({"id": jogo_id})
    await db.tabuada_flashcards_personalizados.delete_many({"jogoId": jogo_id, "usuarioId": current_user["id"]})
    return {"message": "ok"}

# --- Flash cards personalizados (criados pelo próprio aluno) ---
# Cards SOLTOS (jogoId=None) entram no universo da Trilha da Tabuada principal com
# operacao = "custom:<id>" e usam a MESMA máquina de estado do Leitner (db.tabuada_cards)
# que os 100 cards fixos. Cards de um JOGO PERSONALIZADO (jogoId preenchido) ficam de
# fora dessa fila — treinam separados, só dentro do próprio jogo.
@api_router.get("/tabuada/flashcards")
async def get_tabuada_flashcards(jogoId: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    filtro: Dict[str, Any] = {"usuarioId": current_user["id"], "jogoId": jogoId}
    cards = await db.tabuada_flashcards_personalizados.find(filtro).to_list(500)
    return [{k: v for k, v in c.items() if k != '_id'} for c in cards]

@api_router.post("/tabuada/flashcards")
async def criar_tabuada_flashcard(dados: TabuadaFlashcardCreate, current_user: dict = Depends(get_current_user)):
    if dados.tipo not in ("CONTA", "TEXTO"):
        raise HTTPException(status_code=400, detail="Tipo inválido")
    if not dados.enunciado.strip():
        raise HTTPException(status_code=400, detail="Enunciado obrigatório")
    if dados.jogoId:
        jogo = await db.tabuada_jogos_personalizados.find_one({"id": dados.jogoId, "usuarioId": current_user["id"]})
        if not jogo:
            raise HTTPException(status_code=404, detail="Jogo não encontrado")
    novo = {
        "id": str(uuid.uuid4()),
        "usuarioId": current_user["id"],
        "jogoId": dados.jogoId,
        "tipo": dados.tipo,
        "enunciado": dados.enunciado.strip(),
        "respostaCorreta": dados.respostaCorreta,
        "dica": dados.dica,
        "opcoes": dados.opcoes,
        "criadoEm": get_now_brt().isoformat(),
    }
    await db.tabuada_flashcards_personalizados.insert_one(novo)
    return {k: v for k, v in novo.items() if k != '_id'}

@api_router.put("/tabuada/flashcards/{flashcard_id}")
async def atualizar_tabuada_flashcard(flashcard_id: str, dados: TabuadaFlashcardCreate, current_user: dict = Depends(get_current_user)):
    card = await db.tabuada_flashcards_personalizados.find_one({"id": flashcard_id, "usuarioId": current_user["id"]})
    if not card:
        raise HTTPException(status_code=404, detail="Flash card não encontrado")
    if dados.tipo not in ("CONTA", "TEXTO"):
        raise HTTPException(status_code=400, detail="Tipo inválido")
    if not dados.enunciado.strip():
        raise HTTPException(status_code=400, detail="Enunciado obrigatório")
    atualizacao = {
        "tipo": dados.tipo,
        "enunciado": dados.enunciado.strip(),
        "respostaCorreta": dados.respostaCorreta,
        "dica": dados.dica,
        "opcoes": dados.opcoes,
    }
    await db.tabuada_flashcards_personalizados.update_one({"id": flashcard_id}, {"$set": atualizacao})
    card.update(atualizacao)
    return {k: v for k, v in card.items() if k != '_id'}

@api_router.delete("/tabuada/flashcards/{flashcard_id}")
async def deletar_tabuada_flashcard(flashcard_id: str, current_user: dict = Depends(get_current_user)):
    card = await db.tabuada_flashcards_personalizados.find_one({"id": flashcard_id, "usuarioId": current_user["id"]})
    if not card:
        raise HTTPException(status_code=404, detail="Flash card não encontrado")
    await db.tabuada_flashcards_personalizados.delete_one({"id": flashcard_id})
    await db.tabuada_cards.delete_one({"usuarioId": current_user["id"], "operacao": f"custom:{flashcard_id}"})
    return {"message": "ok"}

def _tabuada_evolucao_pct(niveis_por_card: Dict[str, int], total_cards: int = TABUADA_TOTAL_CARDS) -> float:
    """Evolução Leitner (%) = soma de (nível-1) ÷ (total de cards × 4) × 100.
    Cards nunca estudados contam como nível 1 (contribuem 0). total_cards inclui
    os flash cards personalizados que o aluno já criou (100 + quantos criou)."""
    if total_cards <= 0:
        return 0.0
    soma = sum(_tabuada_clamp_nivel(n) - 1 for n in niveis_por_card.values())
    return round(soma / (total_cards * 4) * 100, 1)

async def calcular_evolucao_tabuada(usuario_id: str) -> Dict[str, Any]:
    """Monta todos os dados de evolução de um aluno a partir do histórico REAL
    de respostas. Usado tanto pela tela 'Minha Evolução' do aluno quanto pelo
    relatório individual do professor."""
    respostas = await db.tabuada_respostas.find({"usuarioId": usuario_id}).sort("registradoEm", 1).to_list(50000)
    cards = await db.tabuada_cards.find({"usuarioId": usuario_id}).to_list(300)
    qtd_flashcards = await db.tabuada_flashcards_personalizados.count_documents({"usuarioId": usuario_id})
    total_cards = TABUADA_TOTAL_CARDS + qtd_flashcards

    # --- Estado atual ---
    niveis_atuais = {c["operacao"]: c.get("nivel", 1) for c in cards if c.get("vezesVista", 0) > 0}
    dominados = sum(1 for n in niveis_atuais.values() if _tabuada_clamp_nivel(n) == 5)
    evolucao_atual = _tabuada_evolucao_pct(niveis_atuais, total_cards)

    tempos_acertos = [r["tempoResposta"] for r in respostas if r.get("acertou")]
    tempo_medio = round(sum(tempos_acertos) / len(tempos_acertos), 1) if tempos_acertos else 0.0

    # --- Séries por sessão (ordem cronológica, uma sessão = um treino completo) ---
    # Uma única passada pelo histórico monta TODAS as séries por treino: acertos,
    # tempo médio, evolução Leitner e dominados (estado acumulado até ali), e uso
    # de dica/opções. Isso substitui o agrupamento antigo por DIA (que sumia da
    # tela quando o aluno fazia mais de um treino no mesmo dia) — agora cada
    # TREINO vira um ponto do gráfico, mostrando a evolução por tentativa.
    sessoes_ordem: List[str] = []
    por_sessao: Dict[str, Dict[str, Any]] = {}
    niveis_replay: Dict[str, int] = {}
    numero_sessao = 0
    sessao_atual: Optional[str] = None
    for r in respostas:
        sid = r.get("sessaoId", "?")
        if sid != sessao_atual:
            numero_sessao += 1
            sessoes_ordem.append(sid)
            por_sessao[sid] = {
                "numero": numero_sessao, "acertos": 0, "total": 0, "temposAcertos": [],
                "dicas": 0, "opcoes": 0,
            }
            sessao_atual = sid
        s = por_sessao[sid]
        s["total"] += 1
        if r.get("acertou"):
            s["acertos"] += 1
            s["temposAcertos"].append(r["tempoResposta"])
        if r.get("usouDica"):
            s["dicas"] += 1
        if r.get("usouOpcoes"):
            s["opcoes"] += 1
        niveis_replay[r["operacao"]] = r.get("nivelDepois", 1)
        s["evolucaoApos"] = _tabuada_evolucao_pct(niveis_replay, total_cards)
        s["dominadosApos"] = sum(1 for n in niveis_replay.values() if _tabuada_clamp_nivel(n) == 5)

    acertos_por_sessao = []
    tempo_por_sessao = []
    evolucao_por_sessao = []
    dominados_por_sessao = []
    total_dicas_usadas = 0
    total_opcoes_usadas = 0
    for sid in sessoes_ordem:
        s = por_sessao[sid]
        rotulo = f"Treino {s['numero']}"
        acertos_por_sessao.append({"data": rotulo, "valor": round(s["acertos"] / s["total"] * 100, 1) if s["total"] else 0})
        media = round(sum(s["temposAcertos"]) / len(s["temposAcertos"]), 1) if s["temposAcertos"] else 0
        tempo_por_sessao.append({"data": rotulo, "valor": media})
        evolucao_por_sessao.append({"data": rotulo, "valor": s["evolucaoApos"]})
        dominados_por_sessao.append({"data": rotulo, "valor": s["dominadosApos"]})
        total_dicas_usadas += s["dicas"]
        total_opcoes_usadas += s["opcoes"]

    # --- Dificuldades: operações e tabuadas (fator) com mais erros ---
    stats_op: Dict[str, Dict[str, int]] = {}
    stats_fator: Dict[int, Dict[str, int]] = {}
    for r in respostas:
        op = r["operacao"]
        if op not in stats_op:
            stats_op[op] = {"erros": 0, "total": 0}
        stats_op[op]["total"] += 1
        if not r.get("acertou"):
            stats_op[op]["erros"] += 1
        for fator in (r.get("fator1"), r.get("fator2")):
            if fator is None:
                continue
            if fator not in stats_fator:
                stats_fator[fator] = {"erros": 0, "total": 0}
            stats_fator[fator]["total"] += 1
            if not r.get("acertou"):
                stats_fator[fator]["erros"] += 1

    operacoes_dificeis = sorted(
        [{"operacao": op, "erros": s["erros"], "total": s["total"]} for op, s in stats_op.items() if s["erros"] > 0],
        key=lambda x: (-x["erros"], -(x["erros"] / x["total"]))
    )[:5]

    tabuadas_dificeis = sorted(
        [{"tabuada": f, "erros": s["erros"], "total": s["total"], "taxaErro": round(s["erros"] / s["total"] * 100, 1)}
         for f, s in stats_fator.items() if s["total"] >= 3 and s["erros"] > 0],
        key=lambda x: -x["taxaErro"]
    )[:3]

    ultimos_erros = [r["operacao"] for r in reversed(respostas) if not r.get("acertou")][:5]

    if tabuadas_dificeis:
        nomes = " e ".join(f"do {t['tabuada']}" for t in tabuadas_dificeis[:2])
        recomendacao = f"Revisar tabuadas {nomes}"
    elif dominados >= total_cards:
        recomendacao = "Parabéns! Todas as operações dominadas — continue treinando para manter."
    elif not respostas:
        recomendacao = "Comece seu primeiro treino!"
    else:
        recomendacao = "Continue treinando todos os dias!"

    # Cards vencidos hoje (pra mostrar 'operações que precisam ser revisadas')
    agora_iso = get_now_brt().isoformat()
    vencidos = sorted(
        [c["operacao"] for c in cards if c.get("vezesVista", 0) > 0 and str(c.get("proximaRevisao", "")) <= agora_iso],
    )[:10]

    return {
        "dominados": dominados,
        "totalCards": total_cards,
        "evolucaoPct": evolucao_atual,
        "tempoMedio": tempo_medio,
        "totalRespostas": len(respostas),
        "totalSessoes": len(sessoes_ordem),
        "acertosPorSessao": acertos_por_sessao,
        "tempoPorSessao": tempo_por_sessao,
        "evolucaoPorSessao": evolucao_por_sessao,
        "dominadosPorSessao": dominados_por_sessao,
        "totalDicasUsadas": total_dicas_usadas,
        "totalOpcoesUsadas": total_opcoes_usadas,
        "operacoesDificeis": operacoes_dificeis,
        "tabuadasDificeis": tabuadas_dificeis,
        "ultimosErros": ultimos_erros,
        "cardsVencidos": vencidos,
        "recomendacao": recomendacao,
    }

@api_router.get("/tabuada/evolucao")
async def get_tabuada_evolucao(current_user: dict = Depends(get_current_user)):
    return await calcular_evolucao_tabuada(current_user["id"])

@api_router.get("/tabuada/relatorio")
async def get_tabuada_relatorio(turma_id: Optional[str] = None, current_user: dict = Depends(require_admin)):
    """Visão geral do professor: uma linha por aluno com progresso, dificuldades e
    ranking por evolução (não por velocidade)."""
    filtro_usuarios: Dict[str, Any] = {"ativo": True, "perfil": {"$ne": "ADMIN"}}
    if turma_id:
        filtro_usuarios["turmaId"] = turma_id
    usuarios = await db.usuarios.find(filtro_usuarios).to_list(5000)
    turmas = {str(t.get("id")): t for t in await db.turmas.find({}).to_list(100)}

    ids = [u["id"] for u in usuarios]
    todos_cards = await db.tabuada_cards.find({"usuarioId": {"$in": ids}}).to_list(50000)
    cards_por_aluno: Dict[str, list] = {}
    for c in todos_cards:
        cards_por_aluno.setdefault(c["usuarioId"], []).append(c)

    todos_flashcards = await db.tabuada_flashcards_personalizados.find({"usuarioId": {"$in": ids}}).to_list(50000)
    flashcards_por_aluno: Dict[str, int] = {}
    for fc in todos_flashcards:
        flashcards_por_aluno[fc["usuarioId"]] = flashcards_por_aluno.get(fc["usuarioId"], 0) + 1

    # Estatística de erros por tabuada, calculada dos cards (leve o suficiente pra lista)
    linhas = []
    for u in usuarios:
        cards = cards_por_aluno.get(u["id"], [])
        vistos = [c for c in cards if c.get("vezesVista", 0) > 0]
        niveis = {c["operacao"]: c.get("nivel", 1) for c in vistos}
        total_cards = TABUADA_TOTAL_CARDS + flashcards_por_aluno.get(u["id"], 0)
        dominados = sum(1 for n in niveis.values() if _tabuada_clamp_nivel(n) == 5)
        erros_fator: Dict[int, int] = {}
        for c in vistos:
            if c.get("vezesErrada", 0) > 0:
                for fator in (c.get("fator1"), c.get("fator2")):
                    if fator is not None:
                        erros_fator[fator] = erros_fator.get(fator, 0) + c["vezesErrada"]
        piores = [f for f, _ in sorted(erros_fator.items(), key=lambda kv: -kv[1])[:2]]
        turma = turmas.get(str(u.get("turmaId", "")))
        linhas.append({
            "id": u["id"],
            "nome": u.get("nome", "?"),
            "turma": turma.get("nome", "") if turma else "",
            "dominados": dominados,
            "totalCards": total_cards,
            "evolucaoPct": _tabuada_evolucao_pct(niveis, total_cards),
            "cardsEstudados": len(vistos),
            "pioresTabuadas": piores,
        })

    linhas.sort(key=lambda x: -x["evolucaoPct"])
    for i, linha in enumerate(linhas):
        linha["posicao"] = i + 1
    return linhas

@api_router.get("/tabuada/relatorio/aluno/{aluno_id}")
async def get_tabuada_relatorio_aluno(aluno_id: str, current_user: dict = Depends(require_admin)):
    aluno = await db.usuarios.find_one({"id": aluno_id})
    if not aluno:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")
    turma = await db.turmas.find_one({"id": aluno.get("turmaId", "")}) if aluno.get("turmaId") else None
    evolucao = await calcular_evolucao_tabuada(aluno_id)
    evolucao["aluno"] = {"id": aluno["id"], "nome": aluno.get("nome", "?"), "turma": turma.get("nome", "") if turma else ""}
    return evolucao

# =========================================================================
# DESAFIO FLASH CARDS (modo à parte da Trilha da Tabuada, com ranking)
# -------------------------------------------------------------------------
# O aluno escolhe QUAIS tabuadas (1..10) quer enfrentar e a quantidade de
# questões (15/20/30) antes de começar. Isso NÃO mexe no estado do Leitner
# (db.tabuada_cards) — é um modo separado, só pra ranking competitivo.
#
# Pontuação calculada aqui no servidor (nunca confiando no valor que o app
# manda), pra o ranking ser justo de verdade:
#   pontuacaoBase = acertos × pesoMédio(tabuadas escolhidas) × 10
#   bonusTempo    = até 30 pontos, maior quanto menor o tempo médio por
#                   questão (satura em 0 a partir de 12s por questão)
#   pontuacaoFinal = pontuacaoBase + bonusTempo
# A dificuldade pesa muito mais que a velocidade: só escolher tabuadas
# fáceis (peso baixo) limita o teto de pontuação, mesmo respondendo rápido.
# =========================================================================
TABUADA_DESAFIO_PESOS: Dict[int, float] = {1: 1, 2: 1, 3: 2, 4: 2, 5: 2, 6: 3, 7: 3, 8: 3, 9: 3, 10: 1}
TABUADA_DESAFIO_BONUS_TEMPO_MAX = 30
TABUADA_DESAFIO_BONUS_TEMPO_REFERENCIA_SEG = 12  # tempo médio/questão a partir do qual o bônus é 0
TABUADA_DESAFIO_QUANTIDADES_VALIDAS = (15, 20, 30)

def _calcular_pontuacao_desafio(tabuadas: List[int], quantidade_questoes: int, acertos: int, tempo_total_segundos: float) -> Dict[str, float]:
    tabuadas_validas = sorted(set(t for t in tabuadas if 1 <= t <= 10)) or [1]
    peso_medio = sum(TABUADA_DESAFIO_PESOS.get(t, 1) for t in tabuadas_validas) / len(tabuadas_validas)
    pontuacao_base = round(acertos * peso_medio * 10, 1)
    tempo_medio_por_questao = (tempo_total_segundos / quantidade_questoes) if quantidade_questoes > 0 else 0
    fracao_bonus = max(0.0, 1 - min(1.0, tempo_medio_por_questao / TABUADA_DESAFIO_BONUS_TEMPO_REFERENCIA_SEG))
    bonus_tempo = round(TABUADA_DESAFIO_BONUS_TEMPO_MAX * fracao_bonus, 1)
    return {
        "tabuadas": tabuadas_validas,
        "pesoMedio": round(peso_medio, 2),
        "pontuacaoBase": pontuacao_base,
        "bonusTempo": bonus_tempo,
        "pontuacaoFinal": round(pontuacao_base + bonus_tempo, 1),
        "tempoMedioPorQuestao": round(tempo_medio_por_questao, 3),  # "velocidade média" exibida no ranking
    }

@api_router.post("/tabuada/desafio/resultado")
async def registrar_tabuada_desafio(dados: TabuadaDesafioSubmissao, current_user: dict = Depends(get_current_user)):
    if dados.quantidadeQuestoes not in TABUADA_DESAFIO_QUANTIDADES_VALIDAS:
        raise HTTPException(status_code=400, detail="Quantidade de questões inválida (use 15, 20 ou 30)")
    if not dados.tabuadas or not any(1 <= t <= 10 for t in dados.tabuadas):
        raise HTTPException(status_code=400, detail="Selecione ao menos uma tabuada de 1 a 10")

    acertos = max(0, min(dados.quantidadeQuestoes, dados.acertos))
    tempo_total = max(0.0, dados.tempoTotalSegundos)
    calculo = _calcular_pontuacao_desafio(dados.tabuadas, dados.quantidadeQuestoes, acertos, tempo_total)

    turma = await db.turmas.find_one({"id": current_user.get("turmaId", "")}) if current_user.get("turmaId") else None
    doc = {
        "id": str(uuid.uuid4()),
        "usuarioId": current_user["id"],
        "nome": current_user.get("nome", "?"),
        "turma": turma.get("nome", "") if turma else "",
        "quantidadeQuestoes": dados.quantidadeQuestoes,
        "acertos": acertos,
        "tempoTotalSegundos": round(tempo_total, 1),
        **calculo,
        "registradoEm": get_now_brt().isoformat(),
    }
    await db.tabuada_desafio_resultados.insert_one(doc)
    return {k: v for k, v in doc.items() if k != '_id'}

@api_router.get("/tabuada/desafio/ranking/{quantidade}")
async def get_tabuada_desafio_ranking(quantidade: int, current_user: dict = Depends(get_current_user)):
    if quantidade not in TABUADA_DESAFIO_QUANTIDADES_VALIDAS:
        raise HTTPException(status_code=400, detail="Quantidade de questões inválida (use 15, 20 ou 30)")
    resultados = await db.tabuada_desafio_resultados.find(
        {"quantidadeQuestoes": quantidade}
    ).sort("pontuacaoFinal", -1).to_list(50)
    return [{k: v for k, v in r.items() if k != '_id'} for r in resultados]

@api_router.get("/hangar/perfil")
async def get_hangar_perfil(current_user: dict = Depends(get_current_user)):
    perfil = await get_or_create_hangar_perfil(current_user["id"])
    return {k: v for k, v in perfil.items() if k != '_id'}

@api_router.post("/hangar/upgrade")
async def hangar_upgrade(dados: HangarUpgradeRequest, current_user: dict = Depends(get_current_user)):
    campo_nivel = HANGAR_CAMPOS_NIVEL.get(dados.atributo)
    if not campo_nivel:
        raise HTTPException(status_code=400, detail="Atributo inválido")

    perfil = await get_or_create_hangar_perfil(current_user["id"])
    nivel_atual = perfil.get(campo_nivel, 0)
    if nivel_atual >= HANGAR_NIVEL_MAX:
        raise HTTPException(status_code=400, detail="Atributo já está no nível máximo")

    custo = custo_upgrade_hangar(dados.atributo, nivel_atual)
    moedas_atuais = perfil.get("moedas", 0)
    if moedas_atuais < custo:
        raise HTTPException(status_code=400, detail="Moedas insuficientes")
    moedas_atuais -= custo

    await db.hangar_perfis.update_one(
        {"usuarioId": current_user["id"]},
        {"$inc": {campo_nivel: 1}, "$set": {"moedas": moedas_atuais}}
    )
    perfil_atualizado = await db.hangar_perfis.find_one({"usuarioId": current_user["id"]})
    return {k: v for k, v in perfil_atualizado.items() if k != '_id'}

@api_router.post("/hangar/equipar_arma")
async def hangar_equipar_arma(dados: HangarArmaRequest, current_user: dict = Depends(get_current_user)):
    if dados.arma not in HANGAR_ARMAS_CATALOGO:
        raise HTTPException(status_code=400, detail="Arma inválida")

    perfil = await get_or_create_hangar_perfil(current_user["id"])
    desbloqueadas = perfil.get("armasDesbloqueadas", ["PADRAO"])

    if dados.arma not in desbloqueadas:
        custo = HANGAR_ARMAS_CATALOGO[dados.arma]["custo"]
        moedas_atuais = perfil.get("moedas", 0)
        if moedas_atuais < custo:
            raise HTTPException(status_code=400, detail="Moedas insuficientes para desbloquear essa arma")
        moedas_atuais -= custo
        desbloqueadas = desbloqueadas + [dados.arma]
        await db.hangar_perfis.update_one(
            {"usuarioId": current_user["id"]},
            {"$set": {"armasDesbloqueadas": desbloqueadas, "moedas": moedas_atuais, "armaInicial": dados.arma}}
        )
    else:
        await db.hangar_perfis.update_one({"usuarioId": current_user["id"]}, {"$set": {"armaInicial": dados.arma}})

    perfil_atualizado = await db.hangar_perfis.find_one({"usuarioId": current_user["id"]})
    return {k: v for k, v in perfil_atualizado.items() if k != '_id'}

@api_router.post("/hangar/cor")
async def hangar_cor(dados: HangarCorRequest, current_user: dict = Depends(get_current_user)):
    if dados.cor not in HANGAR_CORES_DISPONIVEIS:
        raise HTTPException(status_code=400, detail="Cor inválida")
    await get_or_create_hangar_perfil(current_user["id"])
    await db.hangar_perfis.update_one({"usuarioId": current_user["id"]}, {"$set": {"corNave": dados.cor}})
    return {"message": "ok", "corNave": dados.cor}

@api_router.post("/hangar/codigo_secreto")
async def hangar_codigo_secreto(dados: HangarCodigoRequest, current_user: dict = Depends(get_current_user)):
    if dados.codigo.strip().upper() != HANGAR_CODIGO_SECRETO:
        raise HTTPException(status_code=400, detail="Código inválido")
    await get_or_create_hangar_perfil(current_user["id"])
    await db.hangar_perfis.update_one({"usuarioId": current_user["id"]}, {"$set": {"habilidadeSecretaDesbloqueada": True}})
    return {"message": "Habilidade secreta desbloqueada!"}

@api_router.post("/hangar/admin_injetar_moedas")
async def hangar_admin_injetar_moedas(dados: HangarInjetarMoedasRequest, current_user: dict = Depends(require_admin)):
    """Backdoor de testes: só funciona pra quem já é ADMIN (checado no backend) E
    sabe o código master. Só injeta moedas na própria conta de quem está logado."""
    if dados.codigoMaster != ADMIN_SANDBOX_MASTER_CODE:
        raise HTTPException(status_code=403, detail="Código master incorreto")
    if dados.quantidade < 0 or dados.quantidade > 999999:
        raise HTTPException(status_code=400, detail="Quantidade inválida")
    await get_or_create_hangar_perfil(current_user["id"])
    await db.hangar_perfis.update_one({"usuarioId": current_user["id"]}, {"$set": {"moedas": dados.quantidade}})
    return {"message": "Moedas injetadas", "moedas": dados.quantidade}

@api_router.post("/hangar/ganhar_moedas")
async def hangar_ganhar_moedas(dados: HangarGanharMoedasRequest, current_user: dict = Depends(get_current_user)):
    """Chamado no fim de uma partida do Equações Espaciais: converte parte do score em
    moedas do hangar (progressão permanente do jogador, separada da pontuação de equipe)."""
    if dados.pontos <= 0:
        return {"moedasGanhas": 0}
    moedas_ganhas = max(0, dados.pontos // 10)
    await get_or_create_hangar_perfil(current_user["id"])
    await db.hangar_perfis.update_one({"usuarioId": current_user["id"]}, {"$inc": {"moedas": moedas_ganhas}})
    return {"moedasGanhas": moedas_ganhas}

# ===== REDEFINIÇÃO DE COMPRAS DA GARAGEM (devolve 25% do valor gasto) =====
@api_router.get("/hangar/gastos")
async def hangar_gastos(current_user: dict = Depends(get_current_user)):
    """Quanto foi gasto em cada item e no total — usado pela tela da Garagem pra
    mostrar os valores REAIS antes do jogador confirmar uma redefinição."""
    perfil = await get_or_create_hangar_perfil(current_user["id"])
    gastos = calcular_gastos_hangar(perfil)
    return {**gastos, "fracaoReembolso": HANGAR_FRACAO_REEMBOLSO}

@api_router.post("/hangar/reset")
async def hangar_reset_total(current_user: dict = Depends(get_current_user)):
    """Redefine a nave inteira: remove TODAS as compras (armas e níveis) e devolve
    25% do total gasto. Cor da nave e habilidade secreta não são compras — ficam."""
    perfil = await get_or_create_hangar_perfil(current_user["id"])
    gastos = calcular_gastos_hangar(perfil)
    if gastos["total"] <= 0:
        raise HTTPException(status_code=400, detail="Você ainda não comprou nada para redefinir")
    reembolso = int(gastos["total"] * HANGAR_FRACAO_REEMBOLSO)
    await db.hangar_perfis.update_one(
        {"usuarioId": current_user["id"]},
        {"$set": {
            "armaInicial": "PADRAO", "armasDesbloqueadas": ["PADRAO"],
            **{campo: 0 for campo in HANGAR_CAMPOS_NIVEL.values()},
            "moedas": perfil.get("moedas", 0) + reembolso,
        }},
    )
    perfil_atualizado = await get_or_create_hangar_perfil(current_user["id"])
    return {"perfil": {k: v for k, v in perfil_atualizado.items() if k != '_id'}, "gastoTotal": gastos["total"], "reembolso": reembolso}

@api_router.post("/hangar/reset_item")
async def hangar_reset_item(dados: HangarResetItemRequest, current_user: dict = Depends(get_current_user)):
    """Redefine UM item comprado (uma arma ou um atributo evoluído) e devolve 25%
    do que foi gasto naquele item específico."""
    perfil = await get_or_create_hangar_perfil(current_user["id"])
    gastos = calcular_gastos_hangar(perfil)
    gasto_item = gastos["itens"].get(dados.item, 0)
    if gasto_item <= 0:
        raise HTTPException(status_code=400, detail="Esse item não foi comprado (nada para redefinir)")

    reembolso = int(gasto_item * HANGAR_FRACAO_REEMBOLSO)
    mudancas: Dict[str, Any] = {"moedas": perfil.get("moedas", 0) + reembolso}
    if dados.item in HANGAR_ARMAS_CATALOGO:
        mudancas["armasDesbloqueadas"] = [a for a in perfil.get("armasDesbloqueadas", ["PADRAO"]) if a != dados.item]
        if perfil.get("armaInicial") == dados.item:
            mudancas["armaInicial"] = "PADRAO"
    else:
        mudancas[HANGAR_CAMPOS_NIVEL[dados.item]] = 0

    await db.hangar_perfis.update_one({"usuarioId": current_user["id"]}, {"$set": mudancas})
    perfil_atualizado = await get_or_create_hangar_perfil(current_user["id"])
    return {"perfil": {k: v for k, v in perfil_atualizado.items() if k != '_id'}, "gastoItem": gasto_item, "reembolso": reembolso}

# ===== CONFIGURAÇÃO GLOBAL DE PARTIDA (dashboard "live tweaking" do admin) =====
@api_router.get("/configuracoes")
async def get_configuracoes(jogoId: str = "math_blaster"):
    cfg = await db.configuracoes_jogo.find_one({"jogoId": jogoId})
    if not cfg:
        novo = ConfiguracaoJogo(jogoId=jogoId, powerupsHabilitados=list(DEFAULT_POWERUP_FAMILIES), spawnChancePorInimigo=dict(DEFAULT_ENEMY_SPAWN_CHANCE))
        await db.configuracoes_jogo.insert_one(novo.dict())
        cfg = novo.dict()
    return {k: v for k, v in cfg.items() if k != '_id'}

@api_router.post("/configuracoes")
async def salvar_configuracoes(dados: ConfiguracaoJogo, current_user: dict = Depends(require_admin)):
    doc = dados.dict()
    await db.configuracoes_jogo.replace_one({"jogoId": dados.jogoId}, doc, upsert=True)
    return doc

@api_router.post("/online/ping")
async def ping_online(): return {"status": "ok"}

@api_router.get("/online/users")
async def get_online_users():
    try:
        from socket_manager import players_online
        active_user_ids = [p_data.get("user_id") for sid, p_data in players_online.items() if p_data.get("user_id") and p_data.get("status") != "OFFLINE"]
        if not active_user_ids: return []
        ativos = await db.usuarios.find({"id": {"$in": list(set(active_user_ids))}}).to_list(1000)
        return [{"id": u["id"], "nome": u.get("nome"), "turmaId": u.get("turmaId"), "equipeId": u.get("equipeId")} for u in ativos]
    except Exception: return []

app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

import socketio
from socket_manager import sio
app = socketio.ASGIApp(sio, other_asgi_app=app)
