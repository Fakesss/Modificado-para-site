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
    ultimoAcesso: Optional[str] = None
    dataUltimoPontoArcade: Optional[str] = None

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

class ArcadeScore(BaseModel):
    pontos: int

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
    criadoEm: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
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
        if user_id is None: raise HTTPException(status_code=401, detail="Token inválido")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")
    
    user = await db.usuarios.find_one({"id": user_id})
    if user is None: raise HTTPException(status_code=401, detail="Usuário não encontrado")
    return user

async def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("perfil") != "ADMIN": raise HTTPException(status_code=403, detail="Acesso negado")
    return current_user

def calculate_streak(last_login: Optional[str], current_streak: int) -> tuple:
    today = datetime.utcnow().date()
    if not last_login: return 1, today.isoformat()
    try:
        last_date = datetime.fromisoformat(last_login).date()
        diff = (today - last_date).days
        if diff == 0: return current_streak, last_login
        elif diff == 1: return current_streak + 1, today.isoformat()
        else: return 1, today.isoformat()
    except Exception:
        return 1, today.isoformat()

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

# ============== ROUTES ==============
@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UsuarioCreate):
    existing = await db.usuarios.find_one({"email": user_data.email})
    if existing: raise HTTPException(status_code=400, detail="Email já cadastrado")
    usuario = Usuario(
        nome=user_data.nome, email=user_data.email, senha=get_password_hash(user_data.senha),
        turmaId=user_data.turmaId, equipeId=user_data.equipeId, streakDias=1, streakUltimoLoginData=datetime.utcnow().date().isoformat(),
        ultimoAcesso=datetime.utcnow().isoformat()
    )
    await db.usuarios.insert_one(usuario.dict())
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
    
    new_streak, new_date = calculate_streak(user.get("streakUltimoLoginData"), user.get("streakDias", 0))
    agora = datetime.utcnow().isoformat()
    
    await db.usuarios.update_one(
        {"id": user["id"]}, 
        {"$set": {"streakDias": new_streak, "streakUltimoLoginData": new_date, "ultimoAcesso": agora}}
    )
    user["streakDias"] = new_streak
    user["streakUltimoLoginData"] = new_date
    user["ultimoAcesso"] = agora
    
    access_token = create_access_token(data={"sub": user["id"]})
    return Token(access_token=access_token, token_type="bearer", usuario={k: v for k, v in user.items() if k not in ['senha', '_id']})

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    agora = datetime.utcnow().isoformat()
    await db.usuarios.update_one({"id": current_user["id"]}, {"$set": {"ultimoAcesso": agora}})
    current_user["ultimoAcesso"] = agora
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
    if not equipe: raise HTTPException(status_code=404, detail="Equipe não encontrada")
    return {k: v for k, v in equipe.items() if k != '_id'}

@api_router.delete("/equipes/{equipe_id}")
async def delete_equipe(equipe_id: str, current_user: dict = Depends(require_admin)):
    await db.equipes.update_one({"id": equipe_id}, {"$set": {"ativa": False}})
    return {"message": "Equipe desativada"}

@api_router.get("/usuarios")
async def get_usuarios(current_user: dict = Depends(require_admin)):
    usuarios_brutos = await db.usuarios.find({}).to_list(5000)
    usuarios_ativos = []
    for u in usuarios_brutos:
        ativo_val = u.get("ativo", True)
        if isinstance(ativo_val, str): ativo = ativo_val.lower() in ['true', '1', 't', 'y', 'yes']
        else: ativo = bool(ativo_val)
        if ativo: usuarios_ativos.append({k: v for k, v in u.items() if k not in ['senha', '_id']})
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
    return {"message": "Usuário desativado com sucesso"}

@api_router.post("/usuarios/zerar-pontos")
async def zerar_todos_pontos(current_user: dict = Depends(require_admin)):
    await db.usuarios.update_many({}, {"$set": {"pontosTotais": 0, "recordeJogoSingle": 0, "recordeJogoMulti": 0}})
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
    await db.exercicios.update_one({"id": exercicio_id}, {"$set": {"is_deleted": True, "deleted_at": datetime.utcnow().isoformat()}})
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
        detalhesQuestoes=detalhes, ignorarNoRelatorioBNCC=False
    )
    await db.submissoes.insert_one(submissao.dict())
    
    await db.usuarios.update_one({"id": current_user["id"]}, {"$inc": {"pontosTotais": pontos}})
    
    eq_raw = current_user.get("equipeId")
    if eq_raw:
        await db.equipes.update_one({"id": str(eq_raw).strip()}, {"$inc": {"pontosTotais": pontos}})
    
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
            if eq_raw:
                await db.equipes.update_one({"id": str(eq_raw).strip()}, {"$inc": {"pontosTotais": -pontos}})
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
    await db.conteudos.update_one({"id": conteudo_id}, {"$set": {"is_deleted": True, "deleted_at": datetime.utcnow().isoformat()}})
    return {"message": "Conteúdo movido para a lixeira"}

@api_router.post("/conteudos/{conteudo_id}/concluir")
async def concluir_conteudo(conteudo_id: str, current_user: dict = Depends(get_current_user)):
    conteudo = await db.conteudos.find_one({"id": conteudo_id})
    if not conteudo: raise HTTPException(status_code=404, detail="Conteúdo não encontrado")
    
    ja_concluiu = await db.conteudos_concluidos.find_one({"usuarioId": current_user["id"], "conteudoId": conteudo_id})
    if ja_concluiu: return {"message": "Conteúdo já estava concluído", "pontos": 0}
        
    await db.conteudos_concluidos.insert_one({"usuarioId": current_user["id"], "conteudoId": conteudo_id, "data": datetime.utcnow().isoformat()})
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
    
    submissoes_exercicios = await db.submissoes.find({
        "exercicioId": {"$in": ids_ativos},
        "ignorarNoRelatorioBNCC": {"$ne": True}
    }).to_list(10000)
    
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
# ROTAS DO RANKING (GERAL E ARCADE)
# =====================================================================
@api_router.get("/ranking/geral")
async def get_ranking_geral():
    equipes = await db.equipes.find({}).to_list(100)
    pontos_por_equipe = {str(e.get("id", e.get("_id", ""))).strip().lower(): 0 for e in equipes}
        
    for aluno in await db.usuarios.find({}).to_list(5000):
        perfil = str(aluno.get("perfil") or "ALUNO").strip().upper()
        ativo_val = aluno.get("ativo", True)
        ativo = ativo_val.lower() in ['true', '1', 't', 'y', 'yes'] if isinstance(ativo_val, str) else bool(ativo_val)
        
        # 🚨 CORREÇÃO: Agora o Radar enxerga ALUNO e ALUNO_LIDER!
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
        
        # 🚨 CORREÇÃO: Agora o Radar enxerga ALUNO e ALUNO_LIDER!
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

@api_router.post("/arcade/score")
async def submit_arcade_score(data: ArcadeScore, current_user: dict = Depends(get_current_user)):
    pontos_score = data.pontos
    if pontos_score <= 0: return {"message": "Nenhum ponto recebido"}
    
    # 1. SALVA O SCORE APENAS NO HALL DA FAMA (Arcade)
    current_record = current_user.get("recordeJogoSingle", 0)
    is_new_record = pontos_score > current_record
    
    if is_new_record:
        # Usamos $set para apenas atualizar o recorde, sem somar em nada
        await db.usuarios.update_one(
            {"id": current_user["id"]}, 
            {"$set": {"recordeJogoSingle": pontos_score}}
        )
        
    # 2. FUNCIONALIDADE DA PONTUAÇÃO DIÁRIA (Ranking Geral)
    # Aqui o sistema vai ignorar os pontos gigantes do score e dar apenas a
    # pontuação fixa configurada (ex: 10 pontos) uma vez ao dia.
    
    # Deixei o código pronto, mas comentado (inativo). Quando for
    # ativar no painel do admin, basta tirar as aspas e buscar o valor real.
    
    """
    hoje = datetime.utcnow().date().isoformat()
    if current_user.get("dataUltimoPontoArcade") != hoje:
        pontos_diarios = 10 # Futuramente: conf.get("pontosDiariosArcade", 0)
        
        if pontos_diarios > 0:
            await db.usuarios.update_one(
                {"id": current_user["id"]}, 
                {
                    "$inc": {"pontosTotais": pontos_diarios},
                    "$set": {"dataUltimoPontoArcade": hoje}
                }
            )
            
            eq_raw = current_user.get("equipeId")
            if eq_raw:
                await db.equipes.update_one(
                    {"id": str(eq_raw).strip()}, 
                    {"$inc": {"pontosTotais": pontos_diarios}}
                )
    """
        
    return {"message": "Score processado com sucesso", "newRecord": is_new_record}

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
            ranking.append({
                "id": u["id"],
                "nome": u.get("nome", "Admin").split(" ")[0],
                "pontosMaximos": pontos_finais,
                "equipe": "",
                "cor": "#FFD700",
                "turma": "Professor",
                "isProf": True
            })
        elif recorde > 0:
            eq = equipes.get(str(u.get("equipeId", "")))
            turma = turmas.get(str(u.get("turmaId", "")))
            ranking.append({
                "id": u["id"],
                "nome": u.get("nome", "Aluno").split(" ")[0],
                "pontosMaximos": recorde,
                "equipe": eq.get("nome", "") if eq else "",
                "cor": eq.get("cor", "#888") if eq else "#888",
                "turma": turma.get("nome", "") if turma else "",
                "isProf": False
            })
            
    ranking.sort(key=lambda x: x["pontosMaximos"], reverse=True)
    for i, r in enumerate(ranking):
        r["posicao"] = i + 1
    return ranking

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

# =====================================================================
# ROTAS DE MISSÕES (JOGOS PERSONALIZADOS)
# =====================================================================
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
    missao.expiraEm = (agora + timedelta(hours=24)).isoformat() 
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
        
    await db.missoes_tentativas.insert_one({"usuarioId": current_user["id"], "missaoId": missao_id, "data": datetime.utcnow().isoformat()})
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

@api_router.post("/missoes/{missao_id}/reenviar")
async def reenviar_missao(missao_id: str, dados: ReenviarData, current_user: dict = Depends(require_admin)):
    old = await db.missoes.find_one({"id": missao_id})
    if not old: raise HTTPException(status_code=404, detail="Missão não encontrada")
    
    new_data = {k: v for k, v in old.items() if k not in ['_id', 'id', 'criadoEm', 'expiraEm', 'alvoTipo', 'alvoNome', 'alvoId', 'tentativasFeitas', 'criadaPor']}
    agora = datetime.utcnow()
    
    new_missao = Missao(
        **new_data, alvoTipo=dados.alvoTipo, alvoNome=dados.alvoNome, alvoId=dados.alvoId,
        criadaPor=current_user["id"], criadoEm=agora.isoformat(), expiraEm=(agora + timedelta(hours=24)).isoformat()
    )
    await db.missoes.insert_one(new_missao.dict())
    return new_missao.dict()

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
    except Exception:
        return []

app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

import socketio
from socket_manager import sio
app = socketio.ASGIApp(sio, other_asgi_app=app)
