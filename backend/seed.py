import os
import uuid
from pymongo import MongoClient
from passlib.context import CryptContext

MONGO_URL = os.getenv("MONGO_URL")

if not MONGO_URL:
    print("❌ ERRO: Variável MONGO_URL não encontrada no Render!")
    exit(1)

try:
    print("🔄 Conectando ao MongoDB...")
    client = MongoClient(MONGO_URL)
    db = client.get_default_database()
    
    colecao_turmas = db["turmas"]
    colecao_equipes = db["equipes"]
    colecao_usuarios = db["usuarios"]

    # 1. Verifica e cria Turmas
    if colecao_turmas.count_documents({}) == 0:
        turmas_padrao = [
            {"id": str(uuid.uuid4()), "nome": "6º Ano", "ativa": True, "anoLetivo": 2025},
            {"id": str(uuid.uuid4()), "nome": "7º Ano", "ativa": True, "anoLetivo": 2025},
            {"id": str(uuid.uuid4()), "nome": "8º Ano", "ativa": True, "anoLetivo": 2025},
            {"id": str(uuid.uuid4()), "nome": "9º Ano", "ativa": True, "anoLetivo": 2025}
        ]
        colecao_turmas.insert_many(turmas_padrao)

    # 2. Verifica e cria Equipes
    if colecao_equipes.count_documents({}) == 0:
        equipes_padrao = [
            {"id": str(uuid.uuid4()), "nome": "Equipe Alfa", "cor": "#FF0000", "pontosTotais": 0},
            {"id": str(uuid.uuid4()), "nome": "Equipe Beta", "cor": "#00FF00", "pontosTotais": 0},
            {"id": str(uuid.uuid4()), "nome": "Equipe Gama", "cor": "#0000FF", "pontosTotais": 0}
        ]
        colecao_equipes.insert_many(equipes_padrao)

    # 3. CRIANDO O SEU ACESSO DE ADMINISTRADOR
    email_admin = "danielprofessormatematica@gmail.com"
    
    if colecao_usuarios.count_documents({"email": email_admin}) == 0:
        print("👤 Criando conta de Administrador...")
        # Criptografa a senha para o padrão do sistema
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        senha_criptografada = pwd_context.hash("Daniel123*")
        
        admin_user = {
            "id": str(uuid.uuid4()),
            "nome": "Professor Daniel",
            "email": email_admin,
            "senha": senha_criptografada,
            "perfil": "ADMIN",
            "ativo": True,
            "pontosTotais": 0,
            "streakDias": 0
        }
        colecao_usuarios.insert_one(admin_user)
        print("✅ Administrador criado com sucesso!")

    print("🎉 Banco de dados 100% pronto!")

except Exception as e:
    print(f"❌ Erro crítico: {e}")
    exit(1)
