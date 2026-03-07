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
    
    # 1. Limpando as coleções antigas (que estavam sem 'id' e sem 'ativa')
    db["turmas"].drop()
    db["equipes"].drop()
    print("🧹 Banco de dados limpo para receber o novo formato...")
    
    colecao_turmas = db["turmas"]
    colecao_equipes = db["equipes"]

    # 2. Criando turmas com 'id' único e 'ativa: True' (Exigência do server.py)
    turmas_padrao = [
        {"id": str(uuid.uuid4()), "nome": "6º Ano", "ativa": True, "anoLetivo": 2025},
        {"id": str(uuid.uuid4()), "nome": "7º Ano", "ativa": True, "anoLetivo": 2025},
        {"id": str(uuid.uuid4()), "nome": "8º Ano", "ativa": True, "anoLetivo": 2025},
        {"id": str(uuid.uuid4()), "nome": "9º Ano", "ativa": True, "anoLetivo": 2025}
    ]
    
    # 3. Criando equipes com 'id' único e 'cor' (Exigência do Vercel)
    equipes_padrao = [
        {"id": str(uuid.uuid4()), "nome": "Equipe Alfa", "cor": "#FF0000", "pontosTotais": 0},
        {"id": str(uuid.uuid4()), "nome": "Equipe Beta", "cor": "#00FF00", "pontosTotais": 0},
        {"id": str(uuid.uuid4()), "nome": "Equipe Gama", "cor": "#0000FF", "pontosTotais": 0}
    ]

    colecao_turmas.insert_many(turmas_padrao)
    print("✅ Turmas recriadas com o formato perfeito!")
        
    colecao_equipes.insert_many(equipes_padrao)
    print("✅ Equipes recriadas com o formato perfeito!")

    print("🎉 Banco de dados atualizado e pronto para a Vercel!")

except Exception as e:
    print(f"❌ Erro crítico ao conectar no banco: {e}")
    exit(1)
