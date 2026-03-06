import os
from pymongo import MongoClient

# 1. Tenta pegar a URL do MongoDB configurada no Render
MONGO_URL = os.getenv("MONGO_URL")

if not MONGO_URL:
    print("❌ ERRO: Variável MONGO_URL não encontrada no Render!")
    exit(1)

try:
    print("🔄 Conectando ao MongoDB...")
    # 2. Conecta ao banco de dados
    client = MongoClient(MONGO_URL)
    
    # Pega o banco de dados padrão da sua URL
    db = client.get_default_database()
    colecao_turmas = db["turmas"]

    turmas_padrao = [
        {"nome": "6º Ano"},
        {"nome": "7º Ano"},
        {"nome": "8º Ano"},
        {"nome": "9º Ano"}
    ]

    # 3. Verifica se as turmas já existem
    if colecao_turmas.count_documents({}) == 0:
        colecao_turmas.insert_many(turmas_padrao)
        print("✅ Turmas criadas com sucesso no MongoDB!")
    else:
        print("⚠️ As turmas já existem no banco de dados. Nenhuma ação necessária.")

except Exception as e:
    print(f"❌ Erro crítico ao conectar no banco: {e}")
    exit(1)
