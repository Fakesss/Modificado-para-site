# online_manager.py
import time
from typing import Dict, List, Any

# Dicionário que vive na RAM do servidor (Custo ZERO de banco de dados)
# Formato: { "id_do_usuario": { "nome": "...", "turmaId": "...", "equipeId": "...", "last_ping": tempo } }
_active_users: Dict[str, Dict[str, Any]] = {}

# Tempo máximo sem dar sinal de vida antes de ser considerado Offline (45 segundos)
TIMEOUT_SECONDS = 45

def ping_user(user_id: str, nome: str, turma_id: str, equipe_id: str):
    """Atualiza o 'relógio' do usuário. Se ele não existia na lista, entra agora."""
    _active_users[user_id] = {
        "id": user_id,
        "nome": nome,
        "turmaId": turma_id,
        "equipeId": equipe_id,
        "last_ping": time.time() # Marca o momento exato do sinal de vida
    }

def get_all_online_users() -> List[Dict[str, Any]]:
    """Limpa os inativos e retorna quem sobrou online (Base para o futuro Matchmaking)"""
    current_time = time.time()
    
    # 1. Identifica quem não manda ping há mais de 45 segundos
    stale_users = [uid for uid, data in _active_users.items() if current_time - data["last_ping"] > TIMEOUT_SECONDS]
    
    # 2. Remove os inativos da RAM
    for uid in stale_users:
        del _active_users[uid]
        
    # 3. Retorna a lista limpa
    return list(_active_users.values())
