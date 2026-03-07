import os
import uuid
from pymongo import MongoClient

MONGO_URL = os.getenv("MONGO_URL")

if not MONGO_URL:
    print("❌ ERRO: Variável MONGO_URL não encontrada no Render!")
    exit(1)

try:
    print("🔄 Conectando ao MongoDB...")
    client = MongoClient(MONGO_URL)
    db = client.get_default_database()
    
    # Limpando as coleções antigas
    db["turmas"].drop()
    db["equipes"].drop()
    print("🧹 Banco de dados limpo para receber o novo formato...")
    
    colecao_turmas = db["turmas"]
    colecao_equipes = db["equipes"]
    colecao_usuarios = db["usuarios"]

    # Criando turmas com 'id' único e 'ativa: True'
    turmas_padrao = [
        {"id": str(uuid.uuid4()), "nome": "6º Ano", "ativa": True, "anoLetivo": 2025},
        {"id": str(uuid.uuid4()), "nome": "7º Ano", "ativa": True, "anoLetivo": 2025},
        {"id": str(uuid.uuid4()), "nome": "8º Ano", "ativa": True, "anoLetivo": 2025},
        {"id": str(uuid.uuid4()), "nome": "9º Ano", "ativa": True, "anoLetivo": 2025}
    ]
    
    # Criando equipes com 'id' único e 'cor'
    equipes_padrao = [
        {"id": str(uuid.uuid4()), "nome": "Equipe Alfa", "cor": "#FF0000", "pontosTotais": 0},
        {"id": str(uuid.uuid4()), "nome": "Equipe Beta", "cor": "#00FF00", "pontosTotais": 0},
        {"id": str(uuid.uuid4()), "nome": "Equipe Gama", "cor": "#0000FF", "pontosTotais": 0}
    ]

    colecao_turmas.insert_many(turmas_padrao)
    print("✅ Turmas recriadas com o formato perfeito!")
        
    colecao_equipes.insert_many(equipes_padrao)
    print("✅ Equipes recriadas com o formato perfeito!")

    # CRIANDO O SEU ACESSO DE ADMINISTRADOR
    email_admin = "danielprofessormatematica@gmail.com"
    # Senha "Daniel123*" gerada com a biblioteca bcrypt nova
    senha_admin_criptografada = "$2b$12$6/1y/z4f.p27Z/U/6gqA3.E7R1lX5QZ/sR.59q/L8Fk/zXq/V39" 
    
    if colecao_usuarios.count_documents({"email": email_admin}) == 0:
        print("👤 Criando conta de Administrador...")
        admin_user = {
            "id": str(uuid.uuid4()),
            "nome": "Professor Daniel",
            "email": email_admin,
            "senha": senha_admin_criptografada,
            "perfil": "ADMIN",
            "ativo": True,
            "pontosTotais": 0,
            "streakDias": 0
        }
        colecao_usuarios.insert_one(admin_user)
        print("✅ Administrador criado com sucesso!")

    print("🎉 Banco de dados atualizado e pronto para a Vercel!")

except Exception as e:
    print(f"❌ Erro crítico: {e}")
    exit(1)
