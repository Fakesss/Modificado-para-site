import os
import uuid
import bcrypt  # Agora chamamos a ferramenta certa aqui também!
from pymongo import MongoClient

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

    if colecao_turmas.count_documents({}) == 0:
        turmas_padrao = [
            {"id": str(uuid.uuid4()), "nome": "6º Ano", "ativa": True, "anoLetivo": 2025},
            {"id": str(uuid.uuid4()), "nome": "7º Ano", "ativa": True, "anoLetivo": 2025},
            {"id": str(uuid.uuid4()), "nome": "8º Ano", "ativa": True, "anoLetivo": 2025},
            {"id": str(uuid.uuid4()), "nome": "9º Ano", "ativa": True, "anoLetivo": 2025}
        ]
        colecao_turmas.insert_many(turmas_padrao)

    if colecao_equipes.count_documents({}) == 0:
        equipes_padrao = [
            {"id": str(uuid.uuid4()), "nome": "Equipe Alfa", "cor": "#FF0000", "pontosTotais": 0},
            {"id": str(uuid.uuid4()), "nome": "Equipe Beta", "cor": "#00FF00", "pontosTotais": 0},
            {"id": str(uuid.uuid4()), "nome": "Equipe Gama", "cor": "#0000FF", "pontosTotais": 0}
        ]
        colecao_equipes.insert_many(equipes_padrao)

    email_admin = "danielprofessormatematica@gmail.com"
    
    admin_existente = colecao_usuarios.find_one({"email": email_admin})
    
    if not admin_existente:
        print("👤 Criando conta de Administrador oficial...")
        
        # AGORA SIM! O Python vai calcular a criptografia real da sua senha:
        senha_plana = "Daniel123*"
        senha_real_criptografada = bcrypt.hashpw(senha_plana.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        admin_user = {
            "id": str(uuid.uuid4()),
            "nome": "Professor Daniel",
            "email": email_admin,
            "senha": senha_real_criptografada,
            "perfil": "ADMIN",
            "ativo": True,
            "pontosTotais": 0,
            "streakDias": 0
        }
        colecao_usuarios.insert_one(admin_user)
        print("✅ Administrador criado com sucesso e senha 100% matemática!")
    else:
        print("✅ Administrador já existe. Preservando a conta e a pontuação.")

    print("🎉 Banco de dados atualizado e pronto para a Vercel!")

except Exception as e:
    print(f"❌ Erro crítico: {e}")
    exit(1)
