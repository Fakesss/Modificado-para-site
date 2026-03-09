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
import bcrypt
from jose import JWTError, jwt
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client.get_default_database()

# JWT Settings
SECRET_KEY = os.environ['SECRET_KEY']
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Password hashing
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
    tipo: str
    titulo: str
    descricao: Optional[str] = None
    urlVideo: Optional[str] = None
    arquivo: Optional[str] = None
    ordem: int = 0
    abaCategoria: str = "videos"
    turmaId: Optional[str] = None
    ativo: bool = True
    criadoEm: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    is_deleted: bool = False
    deleted_at: Optional[str] = None

class ConteudoCreate(BaseModel):
    tipo: str
    titulo: str
    descricao: Optional[str] = None
    urlVideo: Optional[str] = None
    arquivo: Optional[str] = None  # >>> ADICIONADO AQUI PARA PERMITIR UPLOAD <<<
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
    criadoEm: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
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
    tipo: str = "INFO"
    anexosRequeridos: bool = False
    lida: bool = False
    criadoEm: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

class AbaPersonalizada(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nome: str
    tipo: str = "LINK"
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
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Token inválido")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")
    
    user = await db.usuarios.find_one({"id": user_id})
    if user is None:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")
    return user

async def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("perfil") != "ADMIN":
        raise HTTPException(status_code=403, detail="Acesso negado")
    return current_user

async def require_leader_or_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("perfil") not in ["ADMIN", "ALUNO_LIDER"]:
        raise HTTPException(status_code=403, detail="Acesso negado")
    return current_user

def calculate_streak(last_login: Optional[str], current_streak: int) -> tuple:
    today = datetime.utcnow().date()
    if not last_login:
        return 1, today.isoformat()
    try:
        last_date = datetime.fromisoformat(last_login).date()
        diff = (today - last_date).days
        if diff == 0: return current_streak, last_login
        elif diff == 1: return current_streak + 1, today.isoformat()
        else: return 1, today.isoformat()
    except Exception:
        return 1, today.isoformat()

# ============== ROUTES ==============

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
    if not user or not verify_password(credentials.senha, user["senha"]):
        raise HTTPException(status_code=401, detail="Email ou senha incorretos")
    if not user.get("ativo", True):
        raise HTTPException(status_code=401, detail="Usuário desativado")
    
    new_streak, new_date = calculate_streak(user.get("streakUltimoLoginData"), user.get("streakDias", 0))
    await db.usuarios.update_one({"id": user["id"]}, {"$set": {"streakDias": new_streak, "streakUltimoLoginData": new_date}})
    user["streakDias"] = new_streak
    user["streakUltimoLoginData"] = new_date
    access_token = create_access_token(data={"sub": user["id"]})
    return Token(access_token=access_token, token_type="bearer", usuario={k: v for k, v in user.items() if k not in ['senha', '_id']})

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {k: v for k, v in current_user.items() if k not in ['senha', '_id']}

@api_router.put("/auth/me")
async def update_me(update_data: dict, current_user: dict = Depends(get_current_user)):
    allowed = ["turmaId", "equipeId"]
    update_dict = {k: v for k, v in update_data.items() if k in allowed}
    if update_dict:
        await db.usuarios.update_one({"id": current_user["id"]}, {"$set": update_dict})
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

@api_router.get("/usuarios")
async def get_usuarios(current_user: dict = Depends(require_admin)):
    usuarios = await db.usuarios.find({"ativo": True}).to_list(1000)
    return [{k: v for k, v in u.items() if k not in ['senha', '_id']} for u in usuarios]

@api_router.get("/exercicios")
async def get_exercicios(turmaId: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {"ativo": True, "is_deleted": {"$ne": True}}
    if turmaId:
        query["$or"] = [{"turmaId": turmaId}, {"turmaId": None}]
    
    if current_user.get("perfil") == "ADMIN":
        query = {"ativo": True, "is_deleted": {"$ne": True}}

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
        alunoId=exercicio_data.alunoId,
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
async def update_exercicio(exercicio_id: str, exercicio_data: ExercicioUpdate, current_user: dict = Depends(require_admin)):
    update_data = exercicio_data.dict(exclude={'questoes'})
    await db.exercicios.update_one({"id": exercicio_id}, {"$set": update_data})
    
    if exercicio_data.questoes is not None:
        await db.questoes.delete_many({"exercicioId": exercicio_id})
        for q_data in exercicio_data.questoes:
            alternativas = [Alternativa(**a) for a in q_data.alternativas]
            questao = Questao(
                exercicioId=exercicio_id,
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

    exercicio = await db.exercicios.find_one({"id": exercicio_id})
    return {k: v for k, v in exercicio.items() if k != '_id'}

@api_router.delete("/exercicios/{exercicio_id}")
async def delete_exercicio(exercicio_id: str, current_user: dict = Depends(require_admin)):
    await db.exercicios.update_one({"id": exercicio_id}, {"$set": {"is_deleted": True, "deleted_at": datetime.utcnow().isoformat()}})
    return {"message": "Exercício movido para a lixeira"}

@api_router.post("/submissoes")
async def create_submissao(submissao_data: SubmissaoCreate, current_user: dict = Depends(get_current_user)):
    exercicio = await db.exercicios.find_one({"id": submissao_data.exercicioId})
    if not exercicio: raise HTTPException(status_code=404, detail="Exercício não encontrado")
    questoes = await db.questoes.find({"exercicioId": submissao_data.exercicioId}).to_list(100)
    
    # 🚨 CORREÇÃO 1: Criado SEM acento para o Python não travar!
    questoes_map = {q["id"]: q for q in questoes}
    
    acertos, erros = 0, 0
    detalhes = []
    
    for resp in submissao_data.respostas:
        questao = questoes_map.get(resp.questaoId)
        if not questao: continue
        correto = resp.resposta.upper().strip() == questao.get("correta", "").upper().strip()
        if correto: acertos += 1
        else: erros += 1
        detalhes.append({
            "questaoId": resp.questaoId,
            "numero": questao.get("numero"),
            "resposta": resp.resposta,
            "correta": questao.get("correta"),
            "acertou": correto,
            "habilidadesBNCC": questao.get("habilidadesBNCC", [])
        })
    
    total = len(questoes)
    nota = (acertos / total * 10) if total > 0 else 0
    
    # 🚨 CORREÇÃO 2: Pega os pontos configurados pelo professor
    pontos_por_questao = exercicio.get("pontosPorQuestao", 1.0)
    pontos = int(acertos * pontos_por_questao)
    
    submissao = Submissao(
        exercicioId=submissao_data.exercicioId,
        usuarioId=current_user["id"],
        respostas=[{"questaoId": r.questaoId, "resposta": r.resposta} for r in submissao_data.respostas],
        acertos=acertos,
        erros=erros,
        nota=round(nota, 1),
        pontosGerados=pontos,
        detalhesQuestoes=detalhes
    )
    await db.submissoes.insert_one(submissao.dict())
    
    # 🚨 CORREÇÃO 3: Soma os pontos do Aluno E DA EQUIPE DELE!
    await db.usuarios.update_one({"id": current_user["id"]}, {"$inc": {"pontosTotais": pontos}})
    if current_user.get("equipeId"):
        await db.equipes.update_one({"id": current_user["equipeId"]}, {"$inc": {"pontosTotais": pontos}})
    
    # SALVA OS ERROS BNCC
    for d in detalhes:
        if not d["acertou"]:
            for bncc in d.get("habilidadesBNCC", []):
                await db.erros_bncc.update_one(
                    {"usuarioId": current_user["id"], "habilidade": bncc},
                    {"$inc": {"count": 1}},
                    upsert=True
                )
    
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
            if current_user.get("equipeId"):
                await db.equipes.update_one({"id": current_user["equipeId"]}, {"$inc": {"pontosTotais": -pontos}})
        await db.submissoes.delete_one({"_id": sub["_id"]})
    return {"message": "Pronto para tentar novamente"}

@api_router.get("/conteudos")
async def get_conteudos(categoria: Optional[str] = None, turmaId: Optional[str] = None):
    query = {"ativo": True, "is_deleted": {"$ne": True}}
    if categoria: query["abaCategoria"] = categoria
    if turmaId: query["$or"] = [{"turmaId": turmaId}, {"turmaId": None}]
    
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
    await db.conteudos.update_one({"id": conteudo_id}, {"$set": {"is_deleted": True, "deleted_at": datetime.utcnow().isoformat()}})
    return {"message": "Conteúdo movido para a lixeira"}

# Outras rotas do sistema
@api_router.get("/relatorios/geral")
async def get_relatorio_geral(current_user: dict = Depends(require_admin)):
    total_u = await db.usuarios.count_documents({"ativo": True})
    total_e = await db.exercicios.count_documents({"ativo": True})
    total_s = await db.submissoes.count_documents({})
    return {"totalUsuarios": total_u, "totalExercicios": total_e, "totalSubmissoes": total_s}

@api_router.get("/relatorios/bncc-erros")
async def get_bncc_erros(current_user: dict = Depends(require_admin)):
    pipeline = [{"$group": {"_id": "$habilidade", "totalErros": {"$sum": "$count"}}}, {"$sort": {"totalErros": -1}}, {"$limit": 20}]
    results = await db.erros_bncc.aggregate(pipeline).to_list(20)
    return [{"habilidade": r["_id"], "totalErros": r["totalErros"]} for r in results]

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

# ============== ROTAS DE RANKING E PROGRESSO FALTANTES ==============

@api_router.get("/ranking/geral")
async def get_ranking_geral():
    equipes = await db.equipes.find({}).sort("pontosTotais", -1).to_list(100)
    ranking = []
    for i, e in enumerate(equipes):
        ranking.append({
            "id": e["id"],
            "posicao": i + 1,
            "nome": e["nome"],
            "cor": e.get("cor", "#333"),
            "pontosTotais": e.get("pontosTotais", 0)
        })
    return ranking

@api_router.get("/ranking/turma/{turma_id}")
async def get_ranking_turma(turma_id: str):
    equipes = await db.equipes.find({"turmaId": turma_id}).sort("pontosTotais", -1).to_list(100)
    ranking = []
    for i, e in enumerate(equipes):
        ranking.append({
            "id": e["id"],
            "posicao": i + 1,
            "nome": e["nome"],
            "cor": e.get("cor", "#333"),
            "pontosTotais": e.get("pontosTotais", 0)
        })
    return ranking

@api_router.get("/usuarios/progresso")
async def get_meu_progresso(current_user: dict = Depends(get_current_user)):
    submissoes = await db.submissoes.find({"usuarioId": current_user["id"]}).sort("data", -1).to_list(100)
    
    return {
        "pontosTotais": current_user.get("pontosTotais", 0),
        "totalExercicios": len(submissoes),
        "pontosExercicios": sum(s.get("pontosGerados", 0) for s in submissoes),
        "totalVideos": 0,
        "pontosVideos": 0,
        "submissoes": [{k: v for k, v in s.items() if k != '_id'} for s in submissoes]
    }

# ============== ROTAS DE MISSÕES / JOGOS PERSONALIZADOS ==============

class MissaoQuestao(BaseModel):
    id: str
    texto: str
    resposta: int

class MissaoCreate(BaseModel):
    titulo: str
    alvoTipo: str  # GERAL, TURMA, INDIVIDUAL
    alvoNome: str
    alvoId: str
    questoes: List[MissaoQuestao] = []
    recompensa: int = 0
    vidas: int = 3
    limiteTentativas: int = 1  # 0 para ilimitado, 1 padrão
    criadoEm: Optional[str] = None
    expiraEm: Optional[str] = None

class Missao(MissaoCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    criadaPor: Optional[str] = None

class ReenviarData(BaseModel):
    alvoTipo: str
    alvoNome: str
    alvoId: str

@api_router.get("/missoes")
async def get_missoes(current_user: dict = Depends(require_admin)):
    missoes = await db.missoes.find({}).sort("criadoEm", -1).to_list(1000)
    return [{k: v for k, v in m.items() if k != '_id'} for m in missoes]

@api_router.post("/missoes")
async def create_missao(missao_data: MissaoCreate, current_user: dict = Depends(require_admin)):
    missao = Missao(**missao_data.dict())
    missao.criadaPor = current_user["id"]
    agora = datetime.utcnow()
    missao.criadoEm = agora.isoformat()
    missao.expiraEm = (agora + timedelta(hours=24)).isoformat() # 24 horas de validade
    
    await db.missoes.insert_one(missao.dict())
    return missao.dict()

@api_router.delete("/missoes/{missao_id}")
async def delete_missao(missao_id: str, current_user: dict = Depends(require_admin)):
    await db.missoes.delete_one({"id": missao_id})
    return {"message": "Missão deletada com sucesso"}

@api_router.get("/missoes/disponiveis")
async def get_missoes_disponiveis(current_user: dict = Depends(get_current_user)):
    agora_iso = datetime.utcnow().isoformat()
    
    query = {
        "$and": [
            {
                "$or": [
                    {"expiraEm": {"$gt": agora_iso}},
                    {"expiraEm": {"$exists": False}} # Para não quebrar as antigas
                ]
            },
            {
                "$or": [
                    {"alvoTipo": "GERAL"},
                    {"alvoTipo": "TURMA", "alvoId": current_user.get("turmaId")},
                    {"alvoTipo": "INDIVIDUAL", "alvoId": current_user["id"]}
                ]
            }
        ]
    }
    missoes = await db.missoes.find(query).to_list(100)
    resultados = []
    
    # Conta quantas vezes o aluno já tentou cada missão
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
    
    # Se limite for 0 é ilimitado
    if limite > 0 and tentativas >= limite:
        raise HTTPException(status_code=400, detail="Limite de tentativas alcançado")
        
    await db.missoes_tentativas.insert_one({"usuarioId": current_user["id"], "missaoId": missao_id, "data": datetime.utcnow().isoformat()})
    return {"message": "Tentativa registrada e permitida"}

@api_router.post("/missoes/{missao_id}/concluir")
async def concluir_missao(missao_id: str, current_user: dict = Depends(get_current_user)):
    missao = await db.missoes.find_one({"id": missao_id})
    if not missao: raise HTTPException(status_code=404, detail="Missão não encontrada")
    
    pontos = missao.get("recompensa", 0)
    await db.usuarios.update_one({"id": current_user["id"]}, {"$inc": {"pontosTotais": pontos}})
    if current_user.get("equipeId"):
        await db.equipes.update_one({"id": current_user["equipeId"]}, {"$inc": {"pontosTotais": pontos}})
        
    return {"message": "Missão concluída", "pontos": pontos}

@api_router.post("/missoes/{missao_id}/reenviar")
async def reenviar_missao(missao_id: str, dados: ReenviarData, current_user: dict = Depends(require_admin)):
    old = await db.missoes.find_one({"id": missao_id})
    if not old: raise HTTPException(status_code=404, detail="Missão não encontrada")
    
    # Filtra os campos velhos para não dar conflito
    new_data = {k: v for k, v in old.items() if k not in ['_id', 'id', 'criadoEm', 'expiraEm', 'alvoTipo', 'alvoNome', 'alvoId', 'tentativasFeitas', 'criadaPor']}
    
    agora = datetime.utcnow()
    
    # Cria a nova missão injetando os dados novos DIRETAMENTE para não dar erro de validação
    new_missao = Missao(
        **new_data,
        alvoTipo=dados.alvoTipo,
        alvoNome=dados.alvoNome,
        alvoId=dados.alvoId,
        criadaPor=current_user["id"],
        criadoEm=agora.isoformat(),
        expiraEm=(agora + timedelta(hours=24)).isoformat()
    )
    
    await db.missoes.insert_one(new_missao.dict())
    return new_missao.dict()
app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
