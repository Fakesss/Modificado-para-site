import os
from pymongo import MongoClient
from datetime import datetime

# Pega o link do seu MongoDB que você configurou no Render
mongo_uri = os.getenv("MONGODB_URI")
client = MongoClient(mongo_uri)
db = client.get_database()

def seed_data():
    print("Iniciando cadastro de turmas e admin...")
    
    # 1. Cria as Turmas (Para você conseguir se cadastrar depois se quiser)
    turmas_iniciais = [
        {"nome": "6º Ano", "created_at": datetime.now()},
        {"nome": "7º Ano", "created_at": datetime.now()},
        {"nome": "8º Ano", "created_at": datetime.now()},
        {"nome": "9º Ano", "created_at": datetime.now()}
    ]
    
    # Insere as turmas se a coleção estiver vazia
    if db.turmas.count_documents({}) == 0:
        db.turmas.insert_many(turmas_iniciais)
        print("Turmas criadas com sucesso!")

    # 2. Cria o seu usuário de ADMIN (Coloque seu e-mail e senha abaixo)
    # IMPORTANTE: Troque 'seu@email.com' e 'suasenha' pelos seus dados reais
    admin_user = {
        "nome": "Administrador",
        "email": "danielprofessormatematica@gmail.com", 
        "senha": "Daniel123*", # O ideal é que a senha fosse criptografada, mas para entrar agora, use assim.
        "role": "admin",
        "created_at": datetime.now()
    }

    # Insere o admin se ele não existir
    if db.usuarios.count_documents({"email": admin_user["email"]}) == 0:
        db.usuarios.insert_one(admin_user)
        print(f"Usuário admin {admin_user['email']} criado!")

if __name__ == "__main__":
    seed_data()
