import asyncio
from typing import Dict, List, Optional
from datetime import datetime
import time
import socketio
import random
import uuid 

sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=False,
    engineio_logger=False
)

players_online: Dict[str, dict] = {}
rooms: Dict[str, dict] = {}
lobbies: Dict[str, dict] = {}

matchmaking_queues = {
    'tictactoe': [],
    'arcade': []
}

# ====================================================
# 🧹 FAXINEIRO DE DESAFIOS (NOVA FUNÇÃO)
# ====================================================
async def remover_desafio_por_sala(room_id):
    for lobby_id, lobby in lobbies.items():
        desafios_para_remover = []
        for ch_id, desafio in lobby.get('desafios', {}).items():
            if desafio.get('room_id') == room_id:
                desafios_para_remover.append(ch_id)
        for ch_id in desafios_para_remover:
            del lobby['desafios'][ch_id]
            # Avisa o aplicativo para sumir com o banner instantaneamente!
            await sio.emit('lobby_challenge_cancelled', {'challenge_id': ch_id}, room=lobby_id)

# ====================================================
# 🛡️ MOTOR DE HISTÓRICO NO MONGODB
# ====================================================
async def save_chat_log(lobby_data):
    if not lobby_data.get('messages'): return
    try:
        from server import db  
        await db.chat_logs.create_index("criadoEm", expireAfterSeconds=1728000)
        
        log_doc = {
            "lobby_id": lobby_data["id"],
            "nome_sala": lobby_data["nome"],
            "criadoEm": datetime.utcnow(),
            "mensagens": lobby_data["messages"]
        }
        await db.chat_logs.insert_one(log_doc)
        print(f"Histórico da sala {lobby_data['nome']} salvo com sucesso!")
    except Exception as e:
        print(f"Erro ao salvar log do chat: {e}")

# ====================================================
# ROTINAS DE CONEXÃO E LIMPEZA
# ====================================================
@sio.event
async def connect(sid, environ):
    players_online[sid] = {'sid': sid, 'name': 'Visitante', 'user_id': None, 'status': 'MENU', 'aceita_convites': True, 'bloqueados_temp': {}, 'convites_pendentes': []}
    await sio.emit('connected', {'sid': sid}, room=sid)

@sio.event
async def disconnect(sid):
    if sid in players_online: del players_online[sid]
    for q_name in matchmaking_queues:
        if sid in matchmaking_queues[q_name]: matchmaking_queues[q_name].remove(sid)

    for lobby_id, lobby in list(lobbies.items()):
        if sid in lobby['players']:
            lobby['players'].remove(sid)
            await sio.leave_room(sid, lobby_id)
            if len(lobby['players']) == 0:
                asyncio.create_task(save_chat_log(lobby))
                del lobbies[lobby_id]
            else:
                if lobby['host'] == sid: lobby['host'] = lobby['players'][0]
                await sio.emit('lobby_update', lobbies[lobby_id], room=lobby_id)
            await broadcast_lobbies()
            break
    
    for room_id, room in list(rooms.items()):
        if sid in room['players']:
            other_players = [p for p in room['players'] if p != sid]
            if other_players: await sio.emit('opponent_disconnected', {}, room=other_players[0])
            for spec_sid in room.get('spectators', []): await sio.emit('match_ended', {}, room=spec_sid)
            for p in room['players']:
                if p in players_online: players_online[p]['status'] = 'MENU'
            await remover_desafio_por_sala(room_id) # 🚨 Limpa o banner
            del rooms[room_id]
            break
    await broadcast_online_users()

# ====================================================
# 🚀 SISTEMA DE SALAS (LOBBY E CHAT)
# ====================================================
async def broadcast_lobbies():
    safe_lobbies = []
    for l_id, l_data in lobbies.items():
        if l_data['status'] == 'ESPERA':
            players_names = [players_online[p_sid]['name'] for p_sid in l_data['players'] if p_sid in players_online]
            safe_lobbies.append({'id': l_id, 'nome': l_data['nome'], 'tipo': l_data['tipo'], 'host_name': players_online[l_data['host']]['name'] if l_data['host'] in players_online else 'Desconhecido', 'jogadores_count': len(l_data['players']), 'max_jogadores': l_data['max_jogadores'], 'players_names': players_names})
    await sio.emit('lobbies_list', safe_lobbies)

@sio.event
async def get_lobbies(sid, data=None):
    await broadcast_lobbies()

@sio.event
async def create_lobby(sid, data):
    if sid not in players_online: return
    lobby_id = f"lobby_{str(uuid.uuid4())[:8]}"
    lobbies[lobby_id] = {'id': lobby_id, 'nome': data.get('nome', 'Sala'), 'tipo': data.get('tipo', 'Bate-papo'), 'host': sid, 'players': [sid], 'max_jogadores': data.get('max_jogadores', 10), 'status': 'ESPERA', 'messages': [], 'desafios': {}}
    await sio.enter_room(sid, lobby_id)
    players_online[sid]['status'] = 'LOBBY'
    await sio.emit('lobby_joined', {**lobbies[lobby_id], 'players_names': [players_online[sid]['name']]}, room=sid)
    await broadcast_lobbies()
    await broadcast_online_users()

@sio.event
async def join_lobby(sid, data):
    lobby_id, is_ghost = data.get('lobby_id'), data.get('is_ghost', False)
    if lobby_id not in lobbies: return await sio.emit('lobby_error', {'msg': 'Sala não encontrada.'}, room=sid)
    lobby = lobbies[lobby_id]
    if not is_ghost and len(lobby['players']) >= lobby['max_jogadores']: return await sio.emit('lobby_error', {'msg': 'A sala está cheia.'}, room=sid)
        
    lobby['players'].append(sid)
    await sio.enter_room(sid, lobby_id)
    players_online[sid]['status'] = 'LOBBY'
    lobby_info = {**lobby, 'players_names': [players_online[p]['name'] for p in lobby['players'] if p in players_online]}
    await sio.emit('lobby_joined', lobby_info, room=sid)
    
    if not is_ghost:
        await sio.emit('lobby_message', {'id': str(uuid.uuid4()), 'sender': 'SISTEMA', 'text': f"{players_online[sid]['name']} entrou na sala.", 'apagada': False}, room=lobby_id)
        await sio.emit('lobby_update', lobby_info, room=lobby_id)
        await broadcast_lobbies()
        await broadcast_online_users()

@sio.event
async def leave_lobby(sid, data):
    lobby_id = data.get('lobby_id')
    if lobby_id in lobbies and sid in lobbies[lobby_id]['players']:
        lobby = lobbies[lobby_id]
        lobby['players'].remove(sid)
        await sio.leave_room(sid, lobby_id)
        players_online[sid]['status'] = 'MENU'
        
        if len(lobby['players']) == 0:
            asyncio.create_task(save_chat_log(lobby))
            del lobbies[lobby_id]
        else:
            if lobby['host'] == sid:
                lobby['host'] = lobby['players'][0]
                await sio.emit('lobby_message', {'id': str(uuid.uuid4()), 'sender': 'SISTEMA', 'text': f"{players_online[lobby['host']]['name']} é o novo líder.", 'apagada': False}, room=lobby_id)
            
            lobby_info = {**lobby, 'players_names': [players_online[p]['name'] for p in lobby['players'] if p in players_online]}
            await sio.emit('lobby_message', {'id': str(uuid.uuid4()), 'sender': 'SISTEMA', 'text': f"{players_online[sid].get('name')} saiu da sala.", 'apagada': False}, room=lobby_id)
            await sio.emit('lobby_update', lobby_info, room=lobby_id)
            
        await sio.emit('lobby_left', {}, room=sid)
        await broadcast_lobbies()
        await broadcast_online_users()

@sio.event
async def admin_delete_lobby(sid, data):
    lobby_id = data.get('lobby_id')
    if lobby_id in lobbies:
        lobby = lobbies[lobby_id]
        await sio.emit('lobby_error', {'msg': 'A sala foi encerrada pela moderação.'}, room=lobby_id)
        asyncio.create_task(save_chat_log(lobby))
        for p in list(lobby['players']):
            if p in players_online: players_online[p]['status'] = 'MENU'
            await sio.leave_room(p, lobby_id)
            await sio.emit('lobby_left', {}, room=p)
        del lobbies[lobby_id]
        await broadcast_lobbies()
        await broadcast_online_users()

@sio.event
async def send_lobby_message(sid, data):
    lobby_id = data.get('lobby_id')
    if lobby_id in lobbies and sid in lobbies[lobby_id]['players']:
        mensagem = {
            'id': str(uuid.uuid4()),
            'sender': players_online[sid]['name'],
            'sender_id': players_online[sid].get('user_id'),
            'text': data.get('text', ''),
            'audio': data.get('audio', None), # 🚨 NOVO: Suporte a Áudio
            'time': datetime.utcnow().strftime('%H:%M'),
            'apagada': False
        }
        lobbies[lobby_id]['messages'].append(mensagem)
        await sio.emit('lobby_message', mensagem, room=lobby_id)

@sio.event
async def delete_lobby_message(sid, data):
    lobby_id = data.get('lobby_id')
    msg_id = data.get('message_id')
    is_admin = data.get('is_admin', False)
    
    if lobby_id in lobbies:
        lobby = lobbies[lobby_id]
        for msg in lobby['messages']:
            if msg.get('id') == msg_id:
                if msg.get('sender_id') == players_online[sid].get('user_id') or is_admin:
                    msg['apagada'] = True
                    await sio.emit('lobby_message_updated', msg, room=lobby_id)
                break

# ====================================================
# ⚔️ SISTEMA DE DESAFIOS DA SALA (ARENA)
# ====================================================
@sio.event
async def create_lobby_challenge(sid, data):
    lobby_id = data.get('lobby_id')
    game_type = data.get('game_type', 'tictactoe')
    modo_operacao = data.get('modo_operacao', 'misto')

    if lobby_id in lobbies and sid in lobbies[lobby_id]['players']:
        if players_online[sid]['status'] == 'JOGANDO_ONLINE':
            return await sio.emit('lobby_error', {'msg': 'Você já está em uma partida!'}, room=sid)

        challenge_id = str(uuid.uuid4())
        desafio = {
            'id': challenge_id,
            'challenger_sid': sid,
            'challenger_name': players_online[sid]['name'],
            'game_type': game_type,
            'modo_operacao': modo_operacao,
            'status': 'ABERTO'
        }
        lobbies[lobby_id]['desafios'][challenge_id] = desafio
        await sio.emit('lobby_challenge_created', desafio, room=lobby_id)

@sio.event
async def accept_lobby_challenge(sid, data):
    lobby_id = data.get('lobby_id')
    challenge_id = data.get('challenge_id')

    if lobby_id in lobbies and challenge_id in lobbies[lobby_id].get('desafios', {}):
        desafio = lobbies[lobby_id]['desafios'][challenge_id]

        if desafio['status'] != 'ABERTO':
            return await sio.emit('lobby_error', {'msg': 'Muito lento! Alguém já aceitou este desafio.'}, room=sid)
        
        if desafio['challenger_sid'] == sid:
            return await sio.emit('lobby_error', {'msg': 'Você não pode jogar contra si mesmo!'}, room=sid)

        p1_sid = desafio['challenger_sid']
        
        if p1_sid not in players_online or players_online[p1_sid]['status'] == 'JOGANDO_ONLINE':
            desafio['status'] = 'CANCELADO'
            await sio.emit('lobby_challenge_cancelled', {'challenge_id': challenge_id}, room=lobby_id)
            return await sio.emit('lobby_error', {'msg': 'O desafiante fugiu ou já está jogando.'}, room=sid)

        desafio['status'] = 'ACEITO'
        desafio['acceptor_sid'] = sid
        desafio['acceptor_name'] = players_online[sid]['name']

        room_id = None
        if desafio['game_type'] == 'tictactoe':
            room_id = await start_tictactoe_match(p1_sid, sid)
        elif desafio['game_type'] == 'arcade':
            room_id = await start_arcade_match(p1_sid, sid, desafio['modo_operacao'])

        if room_id:
            desafio['room_id'] = room_id
            await sio.emit('lobby_challenge_started', {
                'challenge_id': challenge_id,
                'room_id': room_id,
                'game_type': desafio['game_type'],
                'p1_name': desafio['challenger_name'],
                'p2_name': desafio['acceptor_name']
            }, room=lobby_id)

@sio.event
async def cancel_lobby_challenge(sid, data):
    lobby_id = data.get('lobby_id')
    challenge_id = data.get('challenge_id')
    
    if lobby_id in lobbies and challenge_id in lobbies[lobby_id].get('desafios', {}):
        desafio = lobbies[lobby_id]['desafios'][challenge_id]
        if desafio['challenger_sid'] == sid and desafio['status'] == 'ABERTO':
            desafio['status'] = 'CANCELADO'
            await sio.emit('lobby_challenge_cancelled', {'challenge_id': challenge_id}, room=lobby_id)

# ====================================================
# RESTANTE DO CÓDIGO INTACTO (JOGOS)
# ====================================================
@sio.event
async def register_player(sid, data):
    if sid in players_online:
        players_online[sid]['name'] = data.get('name', 'Jogador')
        players_online[sid]['user_id'] = data.get('user_id')
        await broadcast_online_users()

@sio.event
async def request_sync(sid):
    safe_list = [{'sid': s, 'name': info['name'], 'user_id': info['user_id'], 'status': info['status'], 'aceita_convites': info['aceita_convites']} for s, info in players_online.items() if info['user_id']]
    await sio.emit('online_users_list', safe_list, room=sid)

@sio.event
async def update_status(sid, data):
    if sid in players_online:
        novo_status = data.get('status', 'MENU')
        players_online[sid]['status'] = novo_status
        await broadcast_online_users()
        if novo_status == 'MENU' and players_online[sid]['convites_pendentes']:
            for convite in players_online[sid]['convites_pendentes']: await sio.emit('receive_invite', convite, room=sid)
            players_online[sid]['convites_pendentes'] = []

@sio.event
async def toggle_invites(sid, data):
    if sid in players_online:
        players_online[sid]['aceita_convites'] = data.get('accepts', True)
        await broadcast_online_users()

async def broadcast_online_users():
    safe_list = [{'sid': s, 'name': info['name'], 'user_id': info['user_id'], 'status': info['status'], 'aceita_convites': info['aceita_convites']} for s, info in players_online.items() if info['user_id']]
    await sio.emit('online_users_list', safe_list)

@sio.event
async def send_invite(sid, data):
    target_sid, game_type, modo_operacao = data.get('target_sid'), data.get('game_type', 'tictactoe'), data.get('modo_operacao', 'misto')
    if target_sid not in players_online or sid not in players_online: return await sio.emit('invite_error', {'msg': 'Jogador não encontrado.'}, room=sid)
    target, sender = players_online[target_sid], players_online[sid]
    if not target['aceita_convites']: return await sio.emit('invite_error', {'msg': f"{target['name']} não aceita convites."}, room=sid)
    if sender['user_id'] in target['bloqueados_temp']:
        if time.time() < target['bloqueados_temp'][sender['user_id']]: return await sio.emit('invite_error', {'msg': 'Aguarde para convidar novamente.'}, room=sid)
        else: del target['bloqueados_temp'][sender['user_id']]
    convite_data = {'from_sid': sid, 'from_name': sender['name'], 'game_type': game_type, 'modo_operacao': modo_operacao, 'room_id_proposta': f"priv_{sid[:5]}_{target_sid[:5]}"}
    if target['status'] == 'JOGANDO_ONLINE': return await sio.emit('invite_error', {'msg': f"{target['name']} já está jogando!"}, room=sid)
    elif target['status'] in ['JOGANDO_OFFLINE', 'EXERCICIO']:
        target['convites_pendentes'].append(convite_data)
        return await sio.emit('invite_feedback', {'msg': f"Convite na fila para {target['name']}."}, room=sid)
    else:
        await sio.emit('receive_invite', convite_data, room=target_sid)
        return await sio.emit('invite_feedback', {'msg': f"Convite enviado!"}, room=sid)

@sio.event
async def block_player_invites(sid, data):
    if sid in players_online and data.get('user_id_to_block'): players_online[sid]['bloqueados_temp'][data.get('user_id_to_block')] = time.time() + 300

@sio.event
async def accept_invite(sid, data):
    if data.get('from_sid') in players_online:
        if data.get('game_type') == 'tictactoe': await start_tictactoe_match(data.get('from_sid'), sid)
        elif data.get('game_type') == 'arcade': await start_arcade_match(data.get('from_sid'), sid, data.get('modo_operacao', 'misto'))

@sio.event
async def decline_invite(sid, data):
    if data.get('from_sid') in players_online: await sio.emit('invite_error', {'msg': f"{players_online[sid]['name']} recusou o convite."}, room=data.get('from_sid'))

@sio.event
async def get_active_matches(sid):
    await sio.emit('active_matches_list', [{'room_id': r_id, 'game_type': r_info.get('type'), 'player1': r_info['names'][r_info['players'][0]], 'player2': r_info['names'][r_info['players'][1]], 'spectators_count': len(r_info.get('spectators', []))} for r_id, r_info in rooms.items()], room=sid)

@sio.event
async def spectate_match(sid, data):
    room_id = data.get('room_id')
    if room_id in rooms:
        await sio.enter_room(sid, room_id)
        if 'spectators' not in rooms[room_id]: rooms[room_id]['spectators'] = []
        rooms[room_id]['spectators'].append(sid)
        if rooms[room_id]['type'] == 'tictactoe': await sio.emit('spectator_joined', {'board': rooms[room_id].get('board'), 'turn': rooms[room_id].get('turn'), 'vidas': rooms[room_id].get('vidas'), 'names': rooms[room_id].get('names')}, room=sid)
        elif rooms[room_id]['type'] == 'arcade': await sio.emit('spectator_joined', {'pontos': rooms[room_id].get('pontos'), 'vidas': rooms[room_id].get('vidas'), 'names': rooms[room_id].get('names')}, room=sid)

@sio.event
async def leave_spectator(sid, data):
    room_id = data.get('room_id')
    if room_id in rooms and 'spectators' in rooms[room_id] and sid in rooms[room_id]['spectators']:
        rooms[room_id]['spectators'].remove(sid)
        await sio.leave_room(sid, room_id)

@sio.event
async def find_match(sid, data):
    game_type = data.get('game_type', 'tictactoe')
    if sid not in matchmaking_queues[game_type]: matchmaking_queues[game_type].append(sid)
    if len(matchmaking_queues[game_type]) >= 2:
        p1, p2 = matchmaking_queues[game_type].pop(0), matchmaking_queues[game_type].pop(0)
        if game_type == 'tictactoe': await start_tictactoe_match(p1, p2)
        elif game_type == 'arcade': await start_arcade_match(p1, p2, 'misto')

@sio.event
async def cancel_matchmaking(sid):
    for q_name in matchmaking_queues:
        if sid in matchmaking_queues[q_name]: matchmaking_queues[q_name].remove(sid)

def gerar_operacao_simples():
    op = random.choice(['+', '-', 'x'])
    if op == '+': n1, n2, res = random.randint(1, 20), random.randint(1, 20), 0; res = n1 + n2
    elif op == '-': n1 = random.randint(10, 30); n2 = random.randint(1, n1); res = n1 - n2
    else: n1, n2 = random.randint(1, 10), random.randint(1, 10); res = n1 * n2
    return {"texto": f"{n1} {op} {n2}", "resposta": res, "marcadoPor": None}

def check_win(board):
    for a, b, c in [[0,1,2], [3,4,5], [6,7,8], [0,3,6], [1,4,7], [2,5,8], [0,4,8], [2,4,6]]:
        if board[a]['marcadoPor'] and board[a]['marcadoPor'] == board[b]['marcadoPor'] == board[c]['marcadoPor']: return board[a]['marcadoPor']
    if all(cell['marcadoPor'] is not None for cell in board): return 'Empate'
    return None

async def start_tictactoe_match(p1_sid, p2_sid):
    room_id = f"ttt_{p1_sid[:5]}_{p2_sid[:5]}"
    x_sid, o_sid = (p1_sid, p2_sid) if random.choice([True, False]) else (p2_sid, p1_sid)
    board = [gerar_operacao_simples() for _ in range(9)]
    rooms[room_id] = {'type': 'tictactoe', 'players': [p1_sid, p2_sid], 'spectators': [], 'symbols': {x_sid: 'X', o_sid: 'O'}, 'names': {p1_sid: players_online[p1_sid]['name'], p2_sid: players_online[p2_sid]['name']}, 'vidas': {p1_sid: 3, p2_sid: 3}, 'board': board, 'turn': 'X'}
    await sio.enter_room(p1_sid, room_id)
    await sio.enter_room(p2_sid, room_id)
    players_online[p1_sid]['status'] = players_online[p2_sid]['status'] = 'JOGANDO_ONLINE'
    await broadcast_online_users()
    await sio.emit('match_found', {'room_id': room_id, 'game_type': 'tictactoe', 'opponentName': rooms[room_id]['names'][p2_sid], 'mySymbol': rooms[room_id]['symbols'][p1_sid], 'board': board, 'turn': 'X'}, room=p1_sid)
    await sio.emit('match_found', {'room_id': room_id, 'game_type': 'tictactoe', 'opponentName': rooms[room_id]['names'][p1_sid], 'mySymbol': rooms[room_id]['symbols'][p2_sid], 'board': board, 'turn': 'X'}, room=p2_sid)
    
    return room_id 

@sio.event
async def make_move(sid, data):
    room_id, cell_index, resposta = data.get('room_id'), data.get('cellIndex'), data.get('resposta')
    if room_id not in rooms or rooms[room_id]['type'] != 'tictactoe' or sid not in rooms[room_id]['symbols']: return
    room = rooms[room_id]
    my_symbol = room['symbols'][sid]
    if room['turn'] != my_symbol or room['board'][cell_index]['marcadoPor'] is not None: return 
    if int(resposta) == room['board'][cell_index]['resposta']:
        room['board'][cell_index]['marcadoPor'] = my_symbol
        ganhador = check_win(room['board'])
        if ganhador:
            await sio.emit('game_over', {'ganhador': ganhador, 'board': room['board']}, room=room_id)
            for p in room['players']:
                if p in players_online: players_online[p]['status'] = 'MENU'
            await remover_desafio_por_sala(room_id) # 🚨 Limpa o banner
            del rooms[room_id]
            return await broadcast_online_users()
        else: room['turn'] = 'O' if my_symbol == 'X' else 'X'
    else:
        room['vidas'][sid] -= 1
        if room['vidas'][sid] <= 0:
            await sio.emit('game_over', {'ganhador': 'O' if my_symbol == 'X' else 'X', 'board': room['board']}, room=room_id)
            for p in room['players']:
                if p in players_online: players_online[p]['status'] = 'MENU'
            await remover_desafio_por_sala(room_id) # 🚨 Limpa o banner
            del rooms[room_id]
            return await broadcast_online_users()
        else: room['turn'] = 'O' if my_symbol == 'X' else 'X'
    await sio.emit('board_update', {'board': room['board'], 'turn': room['turn'], 'vidas': room['vidas']}, room=room_id)

async def start_arcade_match(p1_sid, p2_sid, modo_operacao):
    room_id = f"arc_{p1_sid[:5]}_{p2_sid[:5]}"
    rooms[room_id] = {'type': 'arcade', 'modo_operacao': modo_operacao, 'players': [p1_sid, p2_sid], 'spectators': [], 'names': {p1_sid: players_online[p1_sid]['name'], p2_sid: players_online[p2_sid]['name']}, 'vidas': {p1_sid: 5, p2_sid: 5}, 'pontos': {p1_sid: 0, p2_sid: 0}, 'host_sid': p1_sid, 'destroyed_ops': set()}
    await sio.enter_room(p1_sid, room_id)
    await sio.enter_room(p2_sid, room_id)
    players_online[p1_sid]['status'] = players_online[p2_sid]['status'] = 'JOGANDO_ONLINE'
    await broadcast_online_users()
    await sio.emit('match_found', {'room_id': room_id, 'game_type': 'arcade', 'modo_operacao': modo_operacao, 'is_host': True, 'opponentName': rooms[room_id]['names'][p2_sid]}, room=p1_sid)
    await sio.emit('match_found', {'room_id': room_id, 'game_type': 'arcade', 'modo_operacao': modo_operacao, 'is_host': False, 'opponentName': rooms[room_id]['names'][p1_sid]}, room=p2_sid)
    
    return room_id 

@sio.event
async def arcade_sync_batch(sid, data):
    if data.get('room_id') in rooms and rooms[data.get('room_id')]['type'] == 'arcade': await sio.emit('arcade_new_batch', {'ops': data.get('ops')}, room=data.get('room_id'), skip_sid=sid)

@sio.event
async def arcade_answer(sid, data):
    room_id, op_id = data.get('room_id'), data.get('op_id')
    if room_id not in rooms or rooms[room_id]['type'] != 'arcade' or op_id in rooms[room_id]['destroyed_ops']: return 
    rooms[room_id]['destroyed_ops'].add(op_id)
    rooms[room_id]['pontos'][sid] += 10
    await sio.emit('arcade_op_destroyed', {'op_id': op_id, 'winner_sid': sid, 'pontos': rooms[room_id]['pontos']}, room=room_id)

@sio.event
async def arcade_miss(sid, data):
    room_id = data.get('room_id')
    if room_id not in rooms or rooms[room_id]['type'] != 'arcade': return
    room = rooms[room_id]
    room['vidas'][sid] -= 1
    await sio.emit('arcade_state_update', {'vidas': room['vidas'], 'pontos': room['pontos']}, room=room_id)
    p1, p2 = room['players']
    if room['vidas'][p1] <= 0 and room['vidas'][p2] <= 0:
        if room['pontos'][p1] > room['pontos'][p2]: ganhador = p1
        elif room['pontos'][p2] > room['pontos'][p1]: ganhador = p2
        else: ganhador = 'Empate'
        await sio.emit('game_over', {'ganhador': ganhador, 'pontos': room['pontos']}, room=room_id)
        for p in room['players']:
            if p in players_online: players_online[p]['status'] = 'MENU'
        await remover_desafio_por_sala(room_id) # 🚨 Limpa o banner
        del rooms[room_id]
        await broadcast_online_users()

@sio.event
async def leave_match(sid, data):
    room_id = data.get('room_id')
    if room_id in rooms:
        other_players = [p for p in rooms[room_id]['players'] if p != sid]
        if other_players: await sio.emit('opponent_disconnected', {}, room=other_players[0])
        for spec_sid in rooms[room_id].get('spectators', []): await sio.emit('match_ended', {}, room=spec_sid)
        for p in rooms[room_id]['players']:
            if p in players_online: players_online[p]['status'] = 'MENU'
        await remover_desafio_por_sala(room_id) # 🚨 Limpa o banner
        del rooms[room_id]
        await broadcast_online_users()

app = socketio.ASGIApp(sio)
