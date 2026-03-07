import os
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

    turmas_padrao = [
        {"nome": "6º Ano"},
        {"nome": "7º Ano"},
        {"nome": "8º Ano"},
        {"nome": "9º Ano"}
    ]
    
    # Criando as equipes que faltavam para a tela funcionar!
    equipes_padrao = [
        {"nome": "Equipe Alfa"},
        {"nome": "Equipe Beta"},
        {"nome": "Equipe Gama"}
    ]

    # Verifica se as turmas existem (como já existem, ele pula)
    if colecao_turmas.count_documents({}) == 0:
        colecao_turmas.insert_many(turmas_padrao)
        print("✅ Turmas criadas!")
    else:
        print("⚠️ Turmas já existem no banco.")
        
    # Verifica e cria as equipes que faltam
    if colecao_equipes.count_documents({}) == 0:
        colecao_equipes.insert_many(equipes_padrao)
        print("✅ Equipes criadas!")
    else:
        print("⚠️ Equipes já existem no banco.")

    print("✅ Banco de dados populado com sucesso!")

except Exception as e:
    print(f"❌ Erro crítico ao conectar no banco: {e}")
    exit(1)
