from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
from jose import JWTError, jwt
import base64
import bcrypt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection (Corrigido para usar a URL do Render)
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client.get_default_database()

# JWT Settings
SECRET_KEY = os.environ.get('SECRET_KEY', 'default_secret_key_for_safety')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

security = HTTPBearer()

# Create the main app
app = FastAPI(title="Ranking Matemática API")
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============== MODELS ==============

class Turma(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nome: str  # 6º Ano, 7º Ano, 8º Ano, 9º Ano
    anoLetivo: int = 2025
    ativa: bool = True

class Equipe(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nome: str  # Alfa, Delta, Omega
    cor: str  # hex color
    turmaId: Optional[str] = None
    pontosTotais: int = 0

class Usuario(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nome: str
    email: str
    senha: str
    perfil: str = "ALUNO"  # ADMIN, ALUNO_LIDER, ALUNO
    turmaId: Optional[str] = None
    equipeId: Optional[str] = None
    ativo: bool = True
    streakDias: int = 0
    streakUltimoLoginData: Optional[str] = None
    pontosTotais: int = 0
    recordeJogoSingle: int = 0
    recordeJogoMulti: int = 0
    ultimoVisto: Optional[str] = None  # Timestamp do último acesso
    online: bool = False  # Se está online agora
    criadoEm: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

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

class Conteudo(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tipo: str  # VIDEO, LINK, MATERIAL
    titulo: str
    descricao: Optional[str] = None
    urlVideo: Optional[str] = None
    arquivo: Optional[str] = None  # base64 for materials
    ordem: int = 0
    abaCategoria: str = "videos"
    turmaId: Optional[str] = None
    ativo: bool = True
    criadoEm: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    # Soft delete fields
    is_deleted: bool = False
    deleted_at: Optional[str] = None

class ConteudoCreate(BaseModel):
    tipo: str
    titulo: str
    descricao: Optional[str] = None
    urlVideo: Optional[str] = None
    ordem: int = 0
    abaCategoria: str = "videos"
    turmaId: Optional[str] = None

class Alternativa(BaseModel):
    letra: str
    texto: str
    cor: str = "#4169E1"

class Questao(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    exercicioId: str
    numero: int
    tipoResposta: str  # MULTIPLA_ESCOLHA, TEXTO
    enunciado: str
    imagemBase64: Optional[str] = None
    alternativas: List[Alternativa] = []
    correta: str = ""  # letra da correta ou texto esperado
    pontuacaoMax: int = 1
    habilidadesBNCC: List[str] = []

class QuestaoCreate(BaseModel):
    numero: int
    tipoResposta: str
    enunciado: str
    imagemBase64: Optional[str] = None
    alternativas: List[Dict[str, str]] = []
    correta: str = ""
    pontuacaoMax: int = 1
    habilidadesBNCC: List[str] = []

class Exercicio(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    titulo: str
    descricao: Optional[str] = None
    modoCriacao: str = "MANUAL"  # PDF, MANUAL
    pdfArquivo: Optional[str] = None  # base64
    habilidadesBNCC: List[str] = []
    ativo: bool = True
    turmaId: Optional[str] = None
    equipeId: Optional[str] = None
    pontosPorQuestao: int = 1
    criadoEm: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    # Soft delete fields
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
    pontosPorQuestao: int = 1
    questoes: List[QuestaoCreate] = []

class RespostaQuestao(BaseModel):
    questaoId: str
    resposta: str

class Submissao(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    exercicioId: str
    usuarioId: str
    data: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    respostas: List[Dict[str, str]] = []
    acertos: int = 0
    erros: int = 0
    nota: float = 0.0
    pontosGerados: int = 0
    detalhesQuestoes: List[Dict[str, Any]] = []

class SubmissaoCreate(BaseModel):
    exercicioId: str
    respostas: List[RespostaQuestao]

class ProgressoVideo(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    conteudoId: str
    usuarioId: str
    tempoAssistidoSeg: int = 0
    duracaoSeg: int = 0
    concluido: bool = False
    dataConclusao: Optional[str] = None
    pontosGerados: int = 0

class ProgressoVideoUpdate(BaseModel):
    conteudoId: str
    tempoAssistidoSeg: int
    duracaoSeg: int

class Notificacao(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    usuarioId: Optional[str] = None
    equipeId: Optional[str] = None
    titulo: str
    mensagem: str
    tipo: str = "INFO"  # INFO, SOLICITACAO_ARQUIVO, SOLICITACAO_INFO
    anexosRequeridos: bool = False
    lida: bool = False
    criadoEm: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

class AbaPersonalizada(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nome: str
    tipo: str = "LINK"  # LINK, PAGINA, VIDEO, LISTA
    conteudo: str = ""
    urlExterna: Optional[str] = None
    ordem: int = 0
    ativa: bool = True

class Token(BaseModel):
    access_token: str
    token_type: str
    usuario: Dict[str, Any]

# ============== HELPERS ==============

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciais inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await db.usuarios.find_one({"id": user_id})
    if user is None:
        raise credentials_exception
    return user

async def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("perfil") != "ADMIN":
        raise HTTPException(status_code=403, detail="Acesso negado. Apenas administradores.")
    return current_user

async def require_leader_or_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("perfil") not in ["ADMIN", "ALUNO_LIDER"]:
        raise HTTPException(status_code=403, detail="Acesso negado.")
    return current_user

def calculate_streak(last_login: Optional[str], current_streak: int) -> tuple:
    """Calculate new streak based on last login date"""
    today = datetime.utcnow().date()
    
    if not last_login:
        return 1, today.isoformat()
    
    try:
        last_date = datetime.fromisoformat(last_login).date()
        diff = (today - last_date).days
        
        if diff == 0:
            return current_streak, last_login
        elif diff == 1:
            return current_streak + 1, today.isoformat()
        else:
            return 1, today.isoformat()
    except Exception:
        return 1, today.isoformat()

# ============== AUTH ROUTES ==============

@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UsuarioCreate):
    existing = await db.usuarios.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email já cadastrado")
    
    usuario = Usuario(
        nome=user_data.nome,
        email=user_data.email,
        senha=get_password_hash(user_data.senha),
        turmaId=user_data.turmaId,
        equipeId=user_data.equipeId,
        streakDias=1,
        streakUltimoLoginData=datetime.utcnow().date().isoformat()
    )
    
    await db.usuarios.insert_one(usuario.dict())
    
    access_token = create_access_token(data={"sub": usuario.id})
    
    user_dict = usuario.dict()
    del user_dict['senha']
    
    return Token(access_token=access_token, token_type="bearer", usuario=user_dict)

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UsuarioLogin):
    user = await db.usuarios.find_one({"email": credentials.email})
    if not user:
        raise HTTPException(status_code=401, detail="Email ou senha incorretos")
    
    if not verify_password(credentials.senha, user["senha"]):
        raise HTTPException(status_code=401, detail="Email ou senha incorretos")
    
    if not user.get("ativo", True):
        raise HTTPException(status_code=401, detail="Usuário desativado")
    
    new_streak, new_date = calculate_streak(
        user.get("streakUltimoLoginData"), 
        user.get("streakDias", 0)
    )
    
    await db.usuarios.update_one(
        {"id": user["id"]},
        {"$set": {"streakDias": new_streak, "streakUltimoLoginData": new_date}}
    )
    
    user["streakDias"] = new_streak
    user["streakUltimoLoginData"] = new_date
    
    access_token = create_access_token(data={"sub": user["id"]})
    
    user_dict = {k: v for k, v in user.items() if k not in ['senha', '_id']}
    
    return Token(access_token=access_token, token_type="bearer", usuario=user_dict)

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    user_dict = {k: v for k, v in current_user.items() if k not in ['senha', '_id']}
    return user_dict

@api_router.put("/auth/me")
async def update_me(update_data: dict, current_user: dict = Depends(get_current_user)):
    allowed_fields = ["turmaId", "equipeId"]
    update_dict = {k: v for k, v in update_data.items() if k in allowed_fields}
    
    if update_dict:
        await db.usuarios.update_one(
            {"id": current_user["id"]},
            {"$set": update_dict}
        )
    
    usuario = await db.usuarios.find_one({"id": current_user["id"]})
    return {k: v for k, v in usuario.items() if k not in ['senha', '_id']}

# ============== TURMA ROUTES ==============

@api_router.get("/turmas")
async def get_turmas():
    turmas = await db.turmas.find({}).to_list(100)
    return [{k: v for k, v in t.items() if k != '_id'} for t in turmas]

@api_router.post("/turmas")
async def create_turma(turma_data: dict, current_user: dict = Depends(require_admin)):
    turma = Turma(**turma_data)
    await db.turmas.insert_one(turma.dict())
    return turma.dict()

@api_router.put("/turmas/{turma_id}")
async def update_turma(turma_id: str, turma_data: dict, current_user: dict = Depends(require_admin)):
    await db.turmas.update_one({"id": turma_id}, {"$set": turma_data})
    turma = await db.turmas.find_one({"id": turma_id})
    return {k: v for k, v in turma.items() if k != '_id'}

@api_router.delete("/turmas/{turma_id}")
async def delete_turma(turma_id: str, current_user: dict = Depends(require_admin)):
    await db.turmas.update_one({"id": turma_id}, {"$set": {"ativa": False}})
    return {"message": "Turma desativada"}

# ============== EQUIPE ROUTES ==============

@api_router.get("/equipes")
async def get_equipes(turmaId: Optional[str] = None):
    query = {}
    if turmaId:
        query["turmaId"] = turmaId
    equipes = await db.equipes.find(query).to_list(100)
    return [{k: v for k, v in e.items() if k != '_id'} for e in equipes]

@api_router.post("/equipes")
async def create_equipe(equipe_data: dict, current_user: dict = Depends(require_admin)):
    equipe = Equipe(**equipe_data)
    await db.equipes.insert_one(equipe.dict())
    return equipe.dict()

@api_router.put("/equipes/{equipe_id}")
async def update_equipe(equipe_id: str, equipe_data: dict, current_user: dict = Depends(require_admin)):
    await db.equipes.update_one({"id": equipe_id}, {"$set": equipe_data})
    equipe = await db.equipes.find_one({"id": equipe_id})
    return {k: v for k, v in equipe.items() if k != '_id'}

# ============== RANKING ROUTES ==============

@api_router.get("/ranking/geral")
async def get_ranking_geral():
    pipeline = [
        {"$match": {"ativo": True}},
        {"$group": {
            "_id": "$equipeId",
            "totalPontos": {"$sum": "$pontosTotais"}
        }},
        {"$lookup": {
            "from": "equipes",
            "localField": "_id",
            "foreignField": "id",
            "as": "equipe"
        }},
        {"$unwind": "$equipe"},
        {"$project": {
            "id": "$equipe.id",
            "nome": "$equipe.nome",
            "cor": "$equipe.cor",
            "pontosTotais": "$totalPontos"
        }},
        {"$sort": {"pontosTotais": -1}}
    ]
    
    results = await db.usuarios.aggregate(pipeline).to_list(100)
    for i, r in enumerate(results):
        r["posicao"] = i + 1
    return results

@api_router.get("/ranking/turma/{turma_id}")
async def get_ranking_por_turma(turma_id: str):
    pipeline = [
        {"$match": {"turmaId": turma_id, "ativo": True}},
        {"$group": {
            "_id": "$equipeId",
            "totalPontos": {"$sum": "$pontosTotais"}
        }},
        {"$lookup": {
            "from": "equipes",
            "localField": "_id",
            "foreignField": "id",
            "as": "equipe"
        }},
        {"$unwind": "$equipe"},
        {"$project": {
            "id": "$equipe.id",
            "nome": "$equipe.nome",
            "cor": "$equipe.cor",
            "pontosTotais": "$totalPontos"
        }},
        {"$sort": {"pontosTotais": -1}}
    ]
    
    results = await db.usuarios.aggregate(pipeline).to_list(100)
    for i, r in enumerate(results):
        r["posicao"] = i + 1
    return results

@api_router.get("/ranking/alunos/{equipe_id}")
async def get_ranking_alunos_equipe(equipe_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["perfil"] == "ALUNO":
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    if current_user["perfil"] == "ALUNO_LIDER" and current_user.get("equipeId") != equipe_id:
        raise HTTPException(status_code=403, detail="Você só pode ver alunos da sua equipe")
    
    alunos = await db.usuarios.find({
        "equipeId": equipe_id,
        "ativo": True,
        "perfil": {"$ne": "ADMIN"}
    }).to_list(100)
    
    ranking = []
    for aluno in alunos:
        ranking.append({
            "id": aluno["id"],
            "nome": aluno["nome"],
            "pontosTotais": aluno.get("pontosTotais", 0),
            "streakDias": aluno.get("streakDias", 0)
        })
    
    ranking.sort(key=lambda x: x["pontosTotais"], reverse=True)
    for i, r in enumerate(ranking):
        r["posicao"] = i + 1
    return ranking

# ============== USUARIO ROUTES (ADMIN) ==============

@api_router.get("/usuarios")
async def get_usuarios(current_user: dict = Depends(require_admin)):
    usuarios = await db.usuarios.find({"ativo": True}).to_list(1000)
    return [{k: v for k, v in u.items() if k not in ['senha', '_id']} for u in usuarios]

@api_router.get("/usuarios/{user_id}")
async def get_usuario(user_id: str, current_user: dict = Depends(get_current_user)):
    usuario = await db.usuarios.find_one({"id": user_id})
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    if current_user["perfil"] == "ALUNO" and current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    if current_user["perfil"] == "ALUNO_LIDER":
        if current_user["id"] != user_id and usuario.get("equipeId") != current_user.get("equipeId"):
            raise HTTPException(status_code=403, detail="Acesso negado")
    
    return {k: v for k, v in usuario.items() if k not in ['senha', '_id']}

@api_router.put("/usuarios/{user_id}")
async def update_usuario(user_id: str, update_data: UsuarioUpdate, current_user: dict = Depends(require_admin)):
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    await db.usuarios.update_one({"id": user_id}, {"$set": update_dict})
    usuario = await db.usuarios.find_one({"id": user_id})
    return {k: v for k, v in usuario.items() if k not in ['senha', '_id']}

@api_router.delete("/usuarios/{user_id}")
async def delete_usuario(user_id: str, current_user: dict = Depends(require_admin)):
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Não é possível excluir a si mesmo")
    await db.usuarios.delete_one({"id": user_id})
    return {"message": "Usuário excluído permanentemente"}

# ============== CONTEUDO ROUTES ==============

@api_router.get("/conteudos")
async def get_conteudos(categoria: Optional[str] = None, turmaId: Optional[str] = None):
    query = {"ativo": True, "is_deleted": {"$ne": True}}
    if categoria:
        query["abaCategoria"] = categoria
    if turmaId:
        query["$or"] = [{"turmaId": turmaId}, {"turmaId": None}]
    
    conteudos = await db.conteudos.find(query).sort("ordem", 1).to_list(1000)
    return [{k: v for k, v in c.items() if k != '_id'} for c in conteudos]

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
    await db.conteudos.update_one(
        {"id": conteudo_id},
        {"$set": {"is_deleted": True, "deleted_at": datetime.utcnow().isoformat()}}
    )
    return {"message": "Conteúdo movido para a lixeira"}

# ============== VIDEO PROGRESS ROUTES ==============

@api_router.post("/progresso-video")
async def update_progresso_video(progresso_data: ProgressoVideoUpdate, current_user: dict = Depends(get_current_user)):
    PONTOS_POR_MINUTO = 2
    PERCENTUAL_CONCLUSAO = 90
    
    user_id = current_user["id"]
    conteudo_id = progresso_data.conteudoId
    
    existing = await db.progresso_video.find_one({
        "usuarioId": user_id,
        "conteudoId": conteudo_id
    })
    
    tempo_assistido = progresso_data.tempoAssistidoSeg
    duracao = progresso_data.duracaoSeg
    
    percentual = (tempo_assistido / duracao * 100) if duracao > 0 else 0
    concluido = percentual >= PERCENTUAL_CONCLUSAO
    
    pontos_gerados = 0
    if concluido and (not existing or not existing.get("concluido")):
        minutos = min(tempo_assistido, duracao) / 60
        pontos_gerados = int(minutos * PONTOS_POR_MINUTO)
        
        await db.usuarios.update_one(
            {"id": user_id},
            {"$inc": {"pontosTotais": pontos_gerados}}
        )
    
    if existing:
        update_data = {
            "tempoAssistidoSeg": max(existing.get("tempoAssistidoSeg", 0), tempo_assistido),
            "duracaoSeg": duracao
        }
        if concluido and not existing.get("concluido"):
            update_data["concluido"] = True
            update_data["dataConclusao"] = datetime.utcnow().isoformat()
            update_data["pontosGerados"] = pontos_gerados
        
        await db.progresso_video.update_one(
            {"id": existing["id"]},
            {"$set": update_data}
        )
        progresso = await db.progresso_video.find_one({"id": existing["id"]})
    else:
        progresso = ProgressoVideo(
            conteudoId=conteudo_id,
            usuarioId=user_id,
            tempoAssistidoSeg=tempo_assistido,
            duracaoSeg=duracao,
            concluido=concluido,
            dataConclusao=datetime.utcnow().isoformat() if concluido else None,
            pontosGerados=pontos_gerados
        )
        await db.progresso_video.insert_one(progresso.dict())
        progresso = progresso.dict()
    
    return {k: v for k, v in progresso.items() if k != '_id'}

@api_router.get("/progresso-video/{conteudo_id}")
async def get_progresso_video(conteudo_id: str, current_user: dict = Depends(get_current_user)):
    progresso = await db.progresso_video.find_one({
        "usuarioId": current_user["id"],
        "conteudoId": conteudo_id
    })
    if progresso:
        return {k: v for k, v in progresso.items() if k != '_id'}
    return {"concluido": False, "tempoAssistidoSeg": 0, "pontosGerados": 0}

@api_router.get("/meu-progresso")
async def get_meu_progresso(current_user: dict = Depends(get_current_user)):
    videos = await db.progresso_video.find({"usuarioId": current_user["id"]}).to_list(1000)
    submissoes = await db.submissoes.find({"usuarioId": current_user["id"]}).to_list(1000)
    
    total_videos = len([v for v in videos if v.get("concluido")])
    total_exercicios = len(submissoes)
    pontos_videos = sum(v.get("pontosGerados", 0) for v in videos)
    pontos_exercicios = sum(s.get("pontosGerados", 0) for s in submissoes)
    
    return {
        "usuario": {k: v for k, v in current_user.items() if k not in ['senha', '_id']},
        "totalVideos": total_videos,
        "totalExercicios": total_exercicios,
        "pontosVideos": pontos_videos,
        "pontosExercicios": pontos_exercicios,
        "pontosTotais": current_user.get("pontosTotais", 0),
        "streakDias": current_user.get("streakDias", 0),
        "videos": [{k: v for k, v in v.items() if k != '_id'} for v in videos],
        "submissoes": [{k: v for k, v in s.items() if k != '_id'} for s in submissoes]
    }

# ============== EXERCICIO ROUTES ==============

@api_router.get("/exercicios")
async def get_exercicios(turmaId: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {"ativo": True, "is_deleted": {"$ne": True}}
    if turmaId:
        query["$or"] = [{"turmaId": turmaId}, {"turmaId": None}]
    
    exercicios = await db.exercicios.find(query).to_list(1000)
    return [{k: v for k, v in e.items() if k != '_id'} for e in exercicios]

@api_router.get("/exercicios/{exercicio_id}")
async def get_exercicio(exercicio_id: str, current_user: dict = Depends(get_current_user)):
    exercicio = await db.exercicios.find_one({"id": exercicio_id})
    if not exercicio:
        raise HTTPException(status_code=404, detail="Exercício não encontrado")
    
    questoes = await db.questoes.find({"exercicioId": exercicio_id}).sort("numero", 1).to_list(100)
    result = {k: v for k, v in exercicio.items() if k != '_id'}
    result["questoes"] = [{k: v for k, v in q.items() if k != '_id'} for q in questoes]
    
    return result

@api_router.post("/exercicios")
async def create_exercicio(exercicio_data: ExercicioCreate, current_user: dict = Depends(require_admin)):
    exercicio = Exercicio(
        titulo=exercicio_data.titulo,
        descricao=exercicio_data.descricao,
        modoCriacao=exercicio_data.modoCriacao,
        pdfArquivo=exercicio_data.pdfArquivo,
        habilidadesBNCC=exercicio_data.habilidadesBNCC,
        turmaId=exercicio_data.turmaId,
        equipeId=exercicio_data.equipeId,
        pontosPorQuestao=exercicio_data.pontosPorQuestao
    )
    
    await db.exercicios.insert_one(exercicio.dict())
    
    for q_data in exercicio_data.questoes:
        alternativas = [Alternativa(**a) for a in q_data.alternativas]
        questao = Questao(
            exercicioId=exercicio.id,
            numero=q_data.numero,
            tipoResposta=q_data.tipoResposta,
            enunciado=q_data.enunciado,
            imagemBase64=q_data.imagemBase64,
            alternativas=alternativas,
            correta=q_data.correta,
            pontuacaoMax=q_data.pontuacaoMax,
            habilidadesBNCC=q_data.habilidadesBNCC
        )
        await db.questoes.insert_one(questao.dict())
    
    return exercicio.dict()

@api_router.put("/exercicios/{exercicio_id}")
async def update_exercicio(exercicio_id: str, exercicio_data: dict, current_user: dict = Depends(require_admin)):
    await db.exercicios.update_one({"id": exercicio_id}, {"$set": exercicio_data})
    exercicio = await db.exercicios.find_one({"id": exercicio_id})
    return {k: v for k, v in exercicio.items() if k != '_id'}

@api_router.delete("/exercicios/{exercicio_id}")
async def delete_exercicio(exercicio_id: str, current_user: dict = Depends(require_admin)):
    await db.exercicios.update_one(
        {"id": exercicio_id},
        {"$set": {"is_deleted": True, "deleted_at": datetime.utcnow().isoformat()}}
    )
    return {"message": "Exercício movido para a lixeira"}

# ============== QUESTAO ROUTES ==============

@api_router.post("/questoes")
async def create_questao(questao_data: dict, current_user: dict = Depends(require_admin)):
    questao = Questao(**questao_data)
    await db.questoes.insert_one(questao.dict())
    return questao.dict()

@api_router.put("/questoes/{questao_id}")
async def update_questao(questao_id: str, questao_data: dict, current_user: dict = Depends(require_admin)):
    await db.questoes.update_one({"id": questao_id}, {"$set": questao_data})
    questao = await db.questoes.find_one({"id": questao_id})
    return {k: v for k, v in questao.items() if k != '_id'}

@api_router.delete("/questoes/{questao_id}")
async def delete_questao(questao_id: str, current_user: dict = Depends(require_admin)):
    await db.questoes.delete_one({"id": questao_id})
    return {"message": "Questão removida"}

# ============== SUBMISSAO ROUTES ==============

@api_router.post("/submissoes")
async def create_submissao(submissao_data: SubmissaoCreate, current_user: dict = Depends(get_current_user)):
    PONTOS_MAX_EXERCICIO = 10
    
    exercicio = await db.exercicios.find_one({"id": submissao_data.exercicioId})
    if not exercicio:
        raise HTTPException(status_code=404, detail="Exercício não encontrado")
    
    questoes = await db.questoes.find({"exercicioId": submissao_data.exercicioId}).to_list(100)
    questoes_map = {q["id"]: q for q in questoes}
    
    acertos = 0
    erros = 0
    detalhes = []
    erros_bncc = []
    
    for resp in submissao_data.respostas:
        questao = questoes_map.get(resp.questaoId)
        if not questao:
            continue
        
        correto = resp.resposta.upper().strip() == questao.get("correta", "").upper().strip()
        
        if correto:
            acertos += 1
        else:
            erros += 1
            erros_bncc.extend(questao.get("habilidadesBNCC", []))
        
        detalhes.append({
            "questaoId": resp.questaoId,
            "numero": questao.get("numero"),
            "resposta": resp.resposta,
            "correta": questao.get("correta"),
            "acertou": correto,
            "habilidadesBNCC": questao.get("habilidadesBNCC", [])
        })
    
    total_questoes = len(questoes)
    nota = (acertos / total_questoes * 10) if total_questoes > 0 else 0
    percentual = (acertos / total_questoes) if total_questoes > 0 else 0
    pontos_gerados = int(percentual * PONTOS_MAX_EXERCICIO)
    
    submissao = Submissao(
        exercicioId=submissao_data.exercicioId,
        usuarioId=current_user["id"],
        respostas=[{"questaoId": r.questaoId, "resposta": r.resposta} for r in submissao_data.respostas],
        acertos=acertos,
        erros=erros,
        nota=round(nota, 1),
        pontosGerados=pontos_gerados,
        detalhesQuestoes=detalhes
    )
    
    await db.submissoes.insert_one(submissao.dict())
    
    await db.usuarios.update_one(
        {"id": current_user["id"]},
        {"$inc": {"pontosTotais": pontos_gerados}}
    )
    
    for bncc in erros_bncc:
        await db.erros_bncc.update_one(
            {"usuarioId": current_user["id"], "habilidade": bncc},
            {"$inc": {"count": 1}},
            upsert=True
        )
    
    return {
        "submissao": {k: v for k, v in submissao.dict().items() if k != '_id'},
        "acertos": acertos,
        "erros": erros,
        "totalQuestoes": total_questoes,
        "nota": round(nota, 1),
        "percentual": round(percentual * 100, 1),
        "pontosGerados": pontos_gerados
    }

# Start the application configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

@app.get("/")
async def root():
    return {"message": "Ranking Matemática API está online!"}
