import os
from pymongo import MongoClient
from datetime import datetime

# 1. Pega o link do seu MongoDB (AGORA COM O NOME CERTO: MONGO_URL)
mongo_uri = os.getenv("MONGO_URL")
client = MongoClient(mongo_uri)

# 2. Pega o nome do banco das suas variáveis (meubanco)
db_name = os.getenv("DB_NAME", "meubanco") 
db = client[db_name]

def seed_data():
    print(f"Iniciando cadastro no banco: {db_name}...")
    
    # Criar turmas
    turmas_iniciais = [
        {"nome": "6º Ano", "created_at": datetime.now()},
        {"nome": "7º Ano", "created_at": datetime.now()},
        {"nome": "8º Ano", "created_at": datetime.now()},
        {"nome": "9º Ano", "created_at": datetime.now()}
    ]
    
    if db.turmas.count_documents({}) == 0:
        db.turmas.insert_many(turmas_iniciais)
        print("✅ Turmas criadas com sucesso!")
    else:
        print("ℹ️ As turmas já existem no banco.")

    # Criar admin
    admin_user = {
        "nome": "Administrador",
        "email": "danielprofessormatematica@gmail.com", 
        "senha": "Daniel123*", 
        "role": "admin",
        "created_at": datetime.now()
    }

    if db.usuarios.count_documents({"email": admin_user["email"]}) == 0:
        db.usuarios.insert_one(admin_user)
        print(f"✅ Usuário admin {admin_user['email']} criado!")
    else:
        print("ℹ️ O usuário admin já existe.")

# ESSA LINHA ABAIXO É O QUE FAZ O SCRIPT FUNCIONAR DE VERDADE:
if __name__ == "__main__":
    seed_data()
