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

# Estruturas de dados avançadas
players_online: Dict[str, dict] = {}  # sid -> info do jogador
rooms: Dict[str, dict] = {}  # room_id -> info da partida
matchmaking_queue = []

# =========================================================================
# GERENCIAMENTO DE CONEXÃO E STATUS
# =========================================================================
@sio.event
async def connect(sid, environ):
    print(f'Client connected: {sid}')
    # Cria o perfil padrão do jogador na RAM
    players_online[sid] = {
        'sid': sid,
        'name': 'Visitante',
        'user_id': None,
        'status': 'MENU', # Pode ser: MENU, JOGANDO_OFFLINE, JOGANDO_ONLINE, EXERCICIO
        'aceita_convites': True,
        'bloqueados_temp': {}, # user_id -> timestamp (pra bloquear por 5 min)
        'convites_pendentes': [] # Fila de convites aguardando o jogador ficar livre
    }
    await sio.emit('connected', {'sid': sid}, room=sid)

@sio.event
async def disconnect(sid):
    if sid in players_online:
        del players_online[sid]
    if sid in matchmaking_queue:
        matchmaking_queue.remove(sid)
    
    # Avisa a todos que a lista online mudou
    await broadcast_online_users()

    # Derruba a sala se o jogador caiu
    for room_id, room in list(rooms.items()):
        if sid in room['players']:
            other_sid = [p for p in room['players'] if p != sid][0]
            await sio.emit('opponent_disconnected', {}, room=other_sid)
            # Desconecta espectadores
            for spec_sid in room.get('spectators', []):
                await sio.emit('match_ended', {}, room=spec_sid)
            del rooms[room_id]
            break

@sio.event
async def register_player(sid, data):
    """O Frontend chama isso logo após conectar para dizer quem é e pegar a lista"""
    if sid in players_online:
        players_online[sid]['name'] = data.get('name', 'Jogador')
        players_online[sid]['user_id'] = data.get('user_id')
        await broadcast_online_users()

@sio.event
async def update_status(sid, data):
    """O Frontend avisa o servidor se o jogador entrou num jogo offline, online ou exercício"""
    if sid in players_online:
        novo_status = data.get('status', 'MENU')
        players_online[sid]['status'] = novo_status
        await broadcast_online_users()
        
        # Se o jogador ficou livre ('MENU'), entrega os convites que estavam retidos
        if novo_status == 'MENU' and players_online[sid]['convites_pendentes']:
            for convite in players_online[sid]['convites_pendentes']:
                await sio.emit('receive_invite', convite, room=sid)
            players_online[sid]['convites_pendentes'] = []

@sio.event
async def toggle_invites(sid, data):
    """O jogador liga ou desliga a opção 'Não Perturbe'"""
    if sid in players_online:
        players_online[sid]['aceita_convites'] = data.get('accepts', True)
        await broadcast_online_users()

async def broadcast_online_users():
    """Envia a lista de jogadores e o status atual para todos no MENU"""
    # Filtra os dados pra não vazar informações secretas (como bloqueios)
    safe_list = []
    for s, info in players_online.items():
        if info['user_id']: # Só manda quem já tá logado de verdade
            safe_list.append({
                'sid': s,
                'name': info['name'],
                'user_id': info['user_id'],
                'status': info['status'],
                'aceita_convites': info['aceita_convites']
            })
    
    # Manda a lista só pra quem tá precisando ver
    await sio.emit('online_users_list', safe_list)

# =========================================================================
# SISTEMA DE CONVITES DIRETOS (NOVO)
# =========================================================================
@sio.event
async def send_invite(sid, data):
    target_sid = data.get('target_sid')
    game_type = data.get('game_type', 'tictactoe') # Pode ser tictactoe, arcade, etc
    
    if target_sid not in players_online or sid not in players_online:
        return await sio.emit('invite_error', {'msg': 'Jogador não encontrado.'}, room=sid)

    target = players_online[target_sid]
    sender = players_online[sid]

    # 1. Checa se o alvo aceita convites (Não Perturbe)
    if not target['aceita_convites']:
        return await sio.emit('invite_error', {'msg': f"{target['name']} não está aceitando convites no momento."}, room=sid)

    # 2. Checa se o remetente está bloqueado por 5 minutos
    if sender['user_id'] in target['bloqueados_temp']:
        if time.time() < target['bloqueados_temp'][sender['user_id']]:
            return await sio.emit('invite_error', {'msg': 'Você não pode convidar este jogador agora.'}, room=sid)
        else:
            del target['bloqueados_temp'][sender['user_id']] # O castigo acabou

    # 3. Checa o Status do Alvo
    convite_data = {
        'from_sid': sid,
        'from_name': sender['name'],
        'game_type': game_type,
        'room_id_proposta': f"priv_{sid[:5]}_{target_sid[:5]}"
    }

    if target['status'] == 'JOGANDO_ONLINE':
        return await sio.emit('invite_error', {'msg': f"{target['name']} já está em uma partida online!"}, room=sid)
    
    elif target['status'] in ['JOGANDO_OFFLINE', 'EXERCICIO']:
        # Guarda na caixa de entrada para ele ver quando terminar
        target['convites_pendentes'].append(convite_data)
        return await sio.emit('invite_feedback', {'msg': f"Convite enviado! {target['name']} está ocupado e verá quando terminar."}, room=sid)
    
    else: # Está no MENU
        await sio.emit('receive_invite', convite_data, room=target_sid)
        return await sio.emit('invite_feedback', {'msg': f"Convite enviado para {target['name']}!"}, room=sid)

@sio.event
async def block_player_invites(sid, data):
    """Bloqueia convites de um jogador específico por 5 minutos"""
    blocked_user_id = data.get('user_id_to_block')
    if sid in players_online and blocked_user_id:
        # Bloqueia por 300 segundos (5 minutos)
        players_online[sid]['bloqueados_temp'][blocked_user_id] = time.time() + 300

@sio.event
async def accept_invite(sid, data):
    from_sid = data.get('from_sid')
    game_type = data.get('game_type')
    
    if from_sid in players_online:
        # Inicia a partida!
        if game_type == 'tictactoe':
            await start_tictactoe_match(from_sid, sid)

@sio.event
async def decline_invite(sid, data):
    from_sid = data.get('from_sid')
    if from_sid in players_online:
        target_name = players_online[sid]['name']
        await sio.emit('invite_error', {'msg': f"{target_name} recusou o seu convite."}, room=from_sid)

# =========================================================================
# MODO ESPECTADOR (NOVO)
# =========================================================================
@sio.event
async def get_active_matches(sid):
    """Retorna as salas ativas para a pessoa escolher qual assistir"""
    active_matches = []
    for r_id, r_info in rooms.items():
        active_matches.append({
            'room_id': r_id,
            'game_type': r_info.get('type', 'Desconhecido'),
            'player1': r_info['names'][r_info['players'][0]],
            'player2': r_info['names'][r_info['players'][1]],
            'spectators_count': len(r_info.get('spectators', []))
        })
    await sio.emit('active_matches_list', active_matches, room=sid)

@sio.event
async def spectate_match(sid, data):
    room_id = data.get('room_id')
    if room_id in rooms:
        sio.enter_room(sid, room_id) # Coloca o espectador na sala de transmissão
        if 'spectators' not in rooms[room_id]:
            rooms[room_id]['spectators'] = []
        rooms[room_id]['spectators'].append(sid)
        
        # Envia o estado atual do jogo para o espectador
        await sio.emit('spectator_joined', {
            'board': rooms[room_id].get('board'),
            'turn': rooms[room_id].get('turn'),
            'vidas': rooms[room_id].get('vidas'),
            'names': rooms[room_id].get('names')
        }, room=sid)

@sio.event
async def leave_spectator(sid, data):
    room_id = data.get('room_id')
    if room_id in rooms and 'spectators' in rooms[room_id]:
        if sid in rooms[room_id]['spectators']:
            rooms[room_id]['spectators'].remove(sid)
        sio.leave_room(sid, room_id)

# =========================================================================
# MATCHMAKING PADRÃO E JOGO DA VELHA (MANTIDOS E APRIMORADOS)
# =========================================================================
@sio.event
async def find_match(sid, data):
    if sid not in matchmaking_queue:
        matchmaking_queue.append(sid)
    if len(matchmaking_queue) >= 2:
        p1_sid = matchmaking_queue.pop(0)
        p2_sid = matchmaking_queue.pop(0)
        await start_tictactoe_match(p1_sid, p2_sid)

@sio.event
async def cancel_matchmaking(sid):
    if sid in matchmaking_queue:
        matchmaking_queue.remove(sid)

def gerar_operacao_simples():
    ops = ['+', '-', 'x']
    op = random.choice(ops)
    if op == '+':
        n1 = random.randint(1, 20); n2 = random.randint(1, 20); res = n1 + n2
    elif op == '-':
        n1 = random.randint(10, 30); n2 = random.randint(1, n1); res = n1 - n2
    else: 
        n1 = random.randint(1, 10); n2 = random.randint(1, 10); res = n1 * n2
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
    if random.choice([True, False]):
        x_sid, o_sid = p1_sid, p2_sid
    else:
        x_sid, o_sid = p2_sid, p1_sid

    board = [gerar_operacao_simples() for _ in range(9)]

    rooms[room_id] = {
        'type': 'tictactoe',
        'players': [p1_sid, p2_sid],
        'spectators': [],
        'symbols': {x_sid: 'X', o_sid: 'O'},
        'names': {p1_sid: players_online[p1_sid]['name'], p2_sid: players_online[p2_sid]['name']},
        'vidas': {p1_sid: 3, p2_sid: 3},
        'board': board,
        'turn': 'X'
    }

    sio.enter_room(p1_sid, room_id)
    sio.enter_room(p2_sid, room_id)
    
    # Atualiza o status para os outros não mandarem convites
    players_online[p1_sid]['status'] = 'JOGANDO_ONLINE'
    players_online[p2_sid]['status'] = 'JOGANDO_ONLINE'
    await broadcast_online_users()

    await sio.emit('match_found', {'room_id': room_id, 'opponentName': rooms[room_id]['names'][p2_sid], 'mySymbol': rooms[room_id]['symbols'][p1_sid], 'board': board, 'turn': 'X'}, room=p1_sid)
    await sio.emit('match_found', {'room_id': room_id, 'opponentName': rooms[room_id]['names'][p1_sid], 'mySymbol': rooms[room_id]['symbols'][p2_sid], 'board': board, 'turn': 'X'}, room=p2_sid)

@sio.event
async def make_move(sid, data):
    room_id = data.get('room_id')
    cell_index = data.get('cellIndex')
    resposta = data.get('resposta')

    if room_id not in rooms: return
    room = rooms[room_id]
    my_symbol = room['symbols'][sid]
    
    if room['turn'] != my_symbol: return 
    if room['board'][cell_index]['marcadoPor'] is not None: return 

    acertou = (int(resposta) == room['board'][cell_index]['resposta'])

    if acertou:
        room['board'][cell_index]['marcadoPor'] = my_symbol
        ganhador = check_win(room['board'])
        if ganhador:
            await sio.emit('game_over', {'ganhador': ganhador, 'board': room['board']}, room=room_id)
            del rooms[room_id]
            return
        else:
            room['turn'] = 'O' if my_symbol == 'X' else 'X'
    else:
        room['vidas'][sid] -= 1
        if room['vidas'][sid] <= 0:
            ganhador = 'O' if my_symbol == 'X' else 'X'
            await sio.emit('game_over', {'ganhador': ganhador, 'board': room['board']}, room=room_id)
            del rooms[room_id]
            return
        else:
            room['turn'] = 'O' if my_symbol == 'X' else 'X'

    # Atualiza jogadores E ESPECTADORES!
    await sio.emit('board_update', {'board': room['board'], 'turn': room['turn'], 'vidas': room['vidas']}, room=room_id)

@sio.event
async def leave_match(sid, data):
    room_id = data.get('room_id')
    if room_id in rooms:
        other_sid = [p for p in rooms[room_id]['players'] if p != sid][0]
        await sio.emit('opponent_disconnected', {}, room=other_sid)
        for spec_sid in rooms[room_id].get('spectators', []):
            await sio.emit('match_ended', {}, room=spec_sid)
        del rooms[room_id]

app = socketio.ASGIApp(sio)
