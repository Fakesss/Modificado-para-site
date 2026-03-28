import asyncio
from typing import Dict, List, Optional
from datetime import datetime
import time
import socketio
import random

sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=False,
    engineio_logger=False
)

players_online: Dict[str, dict] = {}
rooms: Dict[str, dict] = {}

matchmaking_queues = {
    'tictactoe': [],
    'arcade': []
}

@sio.event
async def connect(sid, environ):
    players_online[sid] = {
        'sid': sid,
        'name': 'Visitante',
        'user_id': None,
        'status': 'MENU',
        'aceita_convites': True,
        'bloqueados_temp': {},
        'convites_pendentes': []
    }
    await sio.emit('connected', {'sid': sid}, room=sid)

@sio.event
async def disconnect(sid):
    if sid in players_online:
        del players_online[sid]
        
    for q_name in matchmaking_queues:
        if sid in matchmaking_queues[q_name]:
            matchmaking_queues[q_name].remove(sid)
    
    # LIMPEZA FANTASMA
    for room_id, room in list(rooms.items()):
        if sid in room['players']:
            other_players = [p for p in room['players'] if p != sid]
            if other_players:
                other_sid = other_players[0]
                await sio.emit('opponent_disconnected', {}, room=other_sid)
            for spec_sid in room.get('spectators', []):
                await sio.emit('match_ended', {}, room=spec_sid)
            
            for p in room['players']:
                if p in players_online: players_online[p]['status'] = 'MENU'
            del rooms[room_id]
            break

    await broadcast_online_users()

@sio.event
async def register_player(sid, data):
    if sid in players_online:
        players_online[sid]['name'] = data.get('name', 'Jogador')
        players_online[sid]['user_id'] = data.get('user_id')
        await broadcast_online_users()

# SINCRONIZAÇÃO SILENCIOSA
@sio.event
async def request_sync(sid):
    safe_list = []
    for s, info in players_online.items():
        if info['user_id']:
            safe_list.append({
                'sid': s, 'name': info['name'], 'user_id': info['user_id'],
                'status': info['status'], 'aceita_convites': info['aceita_convites']
            })
    await sio.emit('online_users_list', safe_list, room=sid)

@sio.event
async def update_status(sid, data):
    if sid in players_online:
        novo_status = data.get('status', 'MENU')
        players_online[sid]['status'] = novo_status
        await broadcast_online_users()
        
        if novo_status == 'MENU' and players_online[sid]['convites_pendentes']:
            for convite in players_online[sid]['convites_pendentes']:
                await sio.emit('receive_invite', convite, room=sid)
            players_online[sid]['convites_pendentes'] = []

@sio.event
async def toggle_invites(sid, data):
    if sid in players_online:
        players_online[sid]['aceita_convites'] = data.get('accepts', True)
        await broadcast_online_users()

async def broadcast_online_users():
    safe_list = []
    for s, info in players_online.items():
        if info['user_id']:
            safe_list.append({
                'sid': s, 'name': info['name'], 'user_id': info['user_id'],
                'status': info['status'], 'aceita_convites': info['aceita_convites']
            })
    await sio.emit('online_users_list', safe_list)

@sio.event
async def send_invite(sid, data):
    target_sid = data.get('target_sid')
    game_type = data.get('game_type', 'tictactoe')
    modo_operacao = data.get('modo_operacao', 'misto')
    
    if target_sid not in players_online or sid not in players_online:
        return await sio.emit('invite_error', {'msg': 'Jogador não encontrado.'}, room=sid)

    target = players_online[target_sid]
    sender = players_online[sid]

    if not target['aceita_convites']:
        return await sio.emit('invite_error', {'msg': f"{target['name']} não está aceitando convites no momento."}, room=sid)

    if sender['user_id'] in target['bloqueados_temp']:
        if time.time() < target['bloqueados_temp'][sender['user_id']]:
            return await sio.emit('invite_error', {'msg': 'Você não pode convidar este jogador agora.'}, room=sid)
        else:
            del target['bloqueados_temp'][sender['user_id']]

    convite_data = {
        'from_sid': sid, 'from_name': sender['name'], 'game_type': game_type,
        'modo_operacao': modo_operacao, 'room_id_proposta': f"priv_{sid[:5]}_{target_sid[:5]}"
    }

    if target['status'] == 'JOGANDO_ONLINE':
        return await sio.emit('invite_error', {'msg': f"{target['name']} já está em uma partida online!"}, room=sid)
    elif target['status'] in ['JOGANDO_OFFLINE', 'EXERCICIO']:
        target['convites_pendentes'].append(convite_data)
        return await sio.emit('invite_feedback', {'msg': f"Convite enviado! {target['name']} está ocupado e verá quando terminar."}, room=sid)
    else:
        await sio.emit('receive_invite', convite_data, room=target_sid)
        return await sio.emit('invite_feedback', {'msg': f"Convite enviado para {target['name']}!"}, room=sid)

@sio.event
async def block_player_invites(sid, data):
    blocked_user_id = data.get('user_id_to_block')
    if sid in players_online and blocked_user_id:
        players_online[sid]['bloqueados_temp'][blocked_user_id] = time.time() + 300

@sio.event
async def accept_invite(sid, data):
    from_sid = data.get('from_sid')
    game_type = data.get('game_type')
    modo_operacao = data.get('modo_operacao', 'misto')
    
    if from_sid in players_online:
        if game_type == 'tictactoe':
            await start_tictactoe_match(from_sid, sid)
        elif game_type == 'arcade':
            await start_arcade_match(from_sid, sid, modo_operacao)

@sio.event
async def decline_invite(sid, data):
    from_sid = data.get('from_sid')
    if from_sid in players_online:
        target_name = players_online[sid]['name']
        await sio.emit('invite_error', {'msg': f"{target_name} recusou o seu convite."}, room=from_sid)

@sio.event
async def get_active_matches(sid):
    active_matches = []
    for r_id, r_info in rooms.items():
        active_matches.append({
            'room_id': r_id, 'game_type': r_info.get('type', 'Desconhecido'),
            'player1': r_info['names'][r_info['players'][0]], 'player2': r_info['names'][r_info['players'][1]],
            'spectators_count': len(r_info.get('spectators', []))
        })
    await sio.emit('active_matches_list', active_matches, room=sid)

@sio.event
async def spectate_match(sid, data):
    room_id = data.get('room_id')
    if room_id in rooms:
        await sio.enter_room(sid, room_id)
        if 'spectators' not in rooms[room_id]:
            rooms[room_id]['spectators'] = []
        rooms[room_id]['spectators'].append(sid)
        
        if rooms[room_id]['type'] == 'tictactoe':
            await sio.emit('spectator_joined', {
                'board': rooms[room_id].get('board'), 'turn': rooms[room_id].get('turn'),
                'vidas': rooms[room_id].get('vidas'), 'names': rooms[room_id].get('names')
            }, room=sid)
        elif rooms[room_id]['type'] == 'arcade':
            await sio.emit('spectator_joined', {
                'pontos': rooms[room_id].get('pontos'), 'vidas': rooms[room_id].get('vidas'),
                'names': rooms[room_id].get('names')
            }, room=sid)

@sio.event
async def leave_spectator(sid, data):
    room_id = data.get('room_id')
    if room_id in rooms and 'spectators' in rooms[room_id]:
        if sid in rooms[room_id]['spectators']:
            rooms[room_id]['spectators'].remove(sid)
        await sio.leave_room(sid, room_id)

@sio.event
async def find_match(sid, data):
    game_type = data.get('game_type', 'tictactoe')
    if sid not in matchmaking_queues[game_type]:
        matchmaking_queues[game_type].append(sid)
        
    if len(matchmaking_queues[game_type]) >= 2:
        p1 = matchmaking_queues[game_type].pop(0)
        p2 = matchmaking_queues[game_type].pop(0)
        if game_type == 'tictactoe':
            await start_tictactoe_match(p1, p2)
        elif game_type == 'arcade':
            await start_arcade_match(p1, p2, 'misto')

@sio.event
async def cancel_matchmaking(sid):
    for q_name in matchmaking_queues:
        if sid in matchmaking_queues[q_name]:
            matchmaking_queues[q_name].remove(sid)

# Jogo da Velha
def gerar_operacao_simples():
    ops = ['+', '-', 'x']
    op = random.choice(ops)
    if op == '+': n1 = random.randint(1, 20); n2 = random.randint(1, 20); res = n1 + n2
    elif op == '-': n1 = random.randint(10, 30); n2 = random.randint(1, n1); res = n1 - n2
    else: n1 = random.randint(1, 10); n2 = random.randint(1, 10); res = n1 * n2
    return {"texto": f"{n1} {op} {n2}", "resposta": res, "marcadoPor": None}

def check_win(board):
    lines = [[0,1,2], [3,4,5], [6,7,8], [0,3,6], [1,4,7], [2,5,8], [0,4,8], [2,4,6]]
    for line in lines:
        a, b, c = line
        if board[a]['marcadoPor'] and board[a]['marcadoPor'] == board[b]['marcadoPor'] and board[a]['marcadoPor'] == board[c]['marcadoPor']:
            return board[a]['marcadoPor']
    if all(cell['marcadoPor'] is not None for cell in board): return 'Empate'
    return None

async def start_tictactoe_match(p1_sid, p2_sid):
    room_id = f"ttt_{p1_sid[:5]}_{p2_sid[:5]}"
    if random.choice([True, False]): x_sid, o_sid = p1_sid, p2_sid
    else: x_sid, o_sid = p2_sid, p1_sid

    board = [gerar_operacao_simples() for _ in range(9)]

    rooms[room_id] = {
        'type': 'tictactoe', 'players': [p1_sid, p2_sid], 'spectators': [],
        'symbols': {x_sid: 'X', o_sid: 'O'},
        'names': {p1_sid: players_online[p1_sid]['name'], p2_sid: players_online[p2_sid]['name']},
        'vidas': {p1_sid: 3, p2_sid: 3}, 'board': board, 'turn': 'X'
    }

    await sio.enter_room(p1_sid, room_id)
    await sio.enter_room(p2_sid, room_id)
    
    players_online[p1_sid]['status'] = 'JOGANDO_ONLINE'
    players_online[p2_sid]['status'] = 'JOGANDO_ONLINE'
    await broadcast_online_users()

    await sio.emit('match_found', {'room_id': room_id, 'game_type': 'tictactoe', 'opponentName': rooms[room_id]['names'][p2_sid], 'mySymbol': rooms[room_id]['symbols'][p1_sid], 'board': board, 'turn': 'X'}, room=p1_sid)
    await sio.emit('match_found', {'room_id': room_id, 'game_type': 'tictactoe', 'opponentName': rooms[room_id]['names'][p1_sid], 'mySymbol': rooms[room_id]['symbols'][p2_sid], 'board': board, 'turn': 'X'}, room=p2_sid)

@sio.event
async def make_move(sid, data):
    room_id = data.get('room_id')
    cell_index = data.get('cellIndex')
    resposta = data.get('resposta')

    if room_id not in rooms or rooms[room_id]['type'] != 'tictactoe': return
    room = rooms[room_id]
    if sid not in room['symbols']: return 
    
    my_symbol = room['symbols'][sid]
    if room['turn'] != my_symbol: return 
    if room['board'][cell_index]['marcadoPor'] is not None: return 

    acertou = (int(resposta) == room['board'][cell_index]['resposta'])

    if acertou:
        room['board'][cell_index]['marcadoPor'] = my_symbol
        ganhador = check_win(room['board'])
        if ganhador:
            await sio.emit('game_over', {'ganhador': ganhador, 'board': room['board']}, room=room_id)
            for p in room['players']:
                if p in players_online: players_online[p]['status'] = 'MENU'
            del rooms[room_id]
            await broadcast_online_users()
            return
        else:
            room['turn'] = 'O' if my_symbol == 'X' else 'X'
    else:
        room['vidas'][sid] -= 1
        if room['vidas'][sid] <= 0:
            ganhador = 'O' if my_symbol == 'X' else 'X'
            await sio.emit('game_over', {'ganhador': ganhador, 'board': room['board']}, room=room_id)
            for p in room['players']:
                if p in players_online: players_online[p]['status'] = 'MENU'
            del rooms[room_id]
            await broadcast_online_users()
            return
        else:
            room['turn'] = 'O' if my_symbol == 'X' else 'X'

    await sio.emit('board_update', {'board': room['board'], 'turn': room['turn'], 'vidas': room['vidas']}, room=room_id)

# Arcade
async def start_arcade_match(p1_sid, p2_sid, modo_operacao):
    room_id = f"arc_{p1_sid[:5]}_{p2_sid[:5]}"
    
    rooms[room_id] = {
        'type': 'arcade', 'modo_operacao': modo_operacao, 'players': [p1_sid, p2_sid], 'spectators': [],
        'names': {p1_sid: players_online[p1_sid]['name'], p2_sid: players_online[p2_sid]['name']},
        'vidas': {p1_sid: 5, p2_sid: 5}, 'pontos': {p1_sid: 0, p2_sid: 0},
        'host_sid': p1_sid, 'destroyed_ops': set() 
    }

    await sio.enter_room(p1_sid, room_id)
    await sio.enter_room(p2_sid, room_id)
    
    players_online[p1_sid]['status'] = 'JOGANDO_ONLINE'
    players_online[p2_sid]['status'] = 'JOGANDO_ONLINE'
    await broadcast_online_users()

    await sio.emit('match_found', {'room_id': room_id, 'game_type': 'arcade', 'modo_operacao': modo_operacao, 'is_host': True, 'opponentName': rooms[room_id]['names'][p2_sid]}, room=p1_sid)
    await sio.emit('match_found', {'room_id': room_id, 'game_type': 'arcade', 'modo_operacao': modo_operacao, 'is_host': False, 'opponentName': rooms[room_id]['names'][p1_sid]}, room=p2_sid)

@sio.event
async def arcade_sync_batch(sid, data):
    room_id = data.get('room_id')
    ops = data.get('ops')
    if room_id in rooms and rooms[room_id]['type'] == 'arcade':
        await sio.emit('arcade_new_batch', {'ops': ops}, room=room_id, skip_sid=sid)

@sio.event
async def arcade_answer(sid, data):
    room_id = data.get('room_id')
    op_id = data.get('op_id')
    
    if room_id not in rooms or rooms[room_id]['type'] != 'arcade': return
    room = rooms[room_id]
    if op_id in room['destroyed_ops']: return 

    room['destroyed_ops'].add(op_id)
    room['pontos'][sid] += 10
    await sio.emit('arcade_op_destroyed', {'op_id': op_id, 'winner_sid': sid, 'pontos': room['pontos']}, room=room_id)

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
        del rooms[room_id]
        await broadcast_online_users()

@sio.event
async def leave_match(sid, data):
    room_id = data.get('room_id')
    if room_id in rooms:
        other_players = [p for p in rooms[room_id]['players'] if p != sid]
        if other_players:
            other_sid = other_players[0]
            await sio.emit('opponent_disconnected', {}, room=other_sid)
            
        for spec_sid in rooms[room_id].get('spectators', []):
            await sio.emit('match_ended', {}, room=spec_sid)
        
        for p in rooms[room_id]['players']:
            if p in players_online: players_online[p]['status'] = 'MENU'
        del rooms[room_id]
        await broadcast_online_users()

app = socketio.ASGIApp(sio)
