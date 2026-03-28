import asyncio
from typing import Dict, List, Optional
from datetime import datetime
import socketio
import random

# Socket.IO Manager para multiplayer
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=False, # Desativado para não poluir muito os logs do Render
    engineio_logger=False
)

# Estruturas de dados
players_online: Dict[str, dict] = {}  # sid -> player_info
rooms: Dict[str, dict] = {}  # room_id -> room_info
matchmaking_queue = [] # Fila de espera para encontrar partida

@sio.event
async def connect(sid, environ):
    print(f'Client connected: {sid}')
    await sio.emit('connected', {'sid': sid}, room=sid)

@sio.event
async def disconnect(sid):
    print(f'Client disconnected: {sid}')
    
    # Remove from online players
    if sid in players_online:
        del players_online[sid]
    
    # Remove from matchmaking queue
    if sid in matchmaking_queue:
        matchmaking_queue.remove(sid)
    
    # Handle room cleanup (Se o jogador cair, o outro ganha por W.O)
    for room_id, room in list(rooms.items()):
        if sid in room['players']:
            other_sid = [p for p in room['players'] if p != sid][0]
            await sio.emit('opponent_disconnected', {}, room=other_sid)
            del rooms[room_id]
            break

# =========================================================================
# SISTEMA DE MATCHMAKING (Procurar Partida)
# =========================================================================
@sio.event
async def find_match(sid, data):
    """Jogador clica em 'Jogar Online' e entra na fila"""
    player_info = {
        'sid': sid,
        'name': data.get('name', 'Jogador'),
        'user_id': data.get('user_id')
    }
    players_online[sid] = player_info
    
    if sid not in matchmaking_queue:
        matchmaking_queue.append(sid)
        
    print(f"Player {player_info['name']} in queue. Queue size: {len(matchmaking_queue)}")

    # Se tem 2 ou mais pessoas na fila, cria a partida!
    if len(matchmaking_queue) >= 2:
        p1_sid = matchmaking_queue.pop(0)
        p2_sid = matchmaking_queue.pop(0)
        await start_tictactoe_match(p1_sid, p2_sid)

@sio.event
async def cancel_matchmaking(sid):
    if sid in matchmaking_queue:
        matchmaking_queue.remove(sid)

# =========================================================================
# LÓGICA DO JOGO DA VELHA (TIC-TAC-TOE)
# =========================================================================

def gerar_operacao_simples():
    ops = ['+', '-', 'x']
    op = random.choice(ops)
    if op == '+':
        n1 = random.randint(1, 20)
        n2 = random.randint(1, 20)
        res = n1 + n2
    elif op == '-':
        n1 = random.randint(10, 30)
        n2 = random.randint(1, n1)
        res = n1 - n2
    else: # 'x'
        n1 = random.randint(1, 10)
        n2 = random.randint(1, 10)
        res = n1 * n2
    return {"texto": f"{n1} {op} {n2}", "resposta": res, "marcadoPor": None}

def check_win(board):
    lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], # Linhas
        [0, 3, 6], [1, 4, 7], [2, 5, 8], # Colunas
        [0, 4, 8], [2, 4, 6]             # Diagonais
    ]
    for line in lines:
        a, b, c = line
        if board[a]['marcadoPor'] and board[a]['marcadoPor'] == board[b]['marcadoPor'] and board[a]['marcadoPor'] == board[c]['marcadoPor']:
            return board[a]['marcadoPor']
    
    if all(cell['marcadoPor'] is not None for cell in board):
        return 'Empate'
    
    return None

async def start_tictactoe_match(p1_sid, p2_sid):
    room_id = f"ttt_{p1_sid[:5]}_{p2_sid[:5]}"
    
    # Sorteia quem é X e quem é O
    if random.choice([True, False]):
        x_sid, o_sid = p1_sid, p2_sid
    else:
        x_sid, o_sid = p2_sid, p1_sid

    board = [gerar_operacao_simples() for _ in range(9)]

    rooms[room_id] = {
        'type': 'tictactoe',
        'players': [p1_sid, p2_sid],
        'symbols': {x_sid: 'X', o_sid: 'O'},
        'names': {p1_sid: players_online[p1_sid]['name'], p2_sid: players_online[p2_sid]['name']},
        'vidas': {p1_sid: 3, p2_sid: 3},
        'board': board,
        'turn': 'X' # X sempre começa
    }

    await sio.enter_room(p1_sid, room_id)
    await sio.enter_room(p2_sid, room_id)

    # Avisa o Player 1
    await sio.emit('match_found', {
        'room_id': room_id,
        'opponentName': rooms[room_id]['names'][p2_sid],
        'mySymbol': rooms[room_id]['symbols'][p1_sid],
        'board': board,
        'turn': 'X'
    }, room=p1_sid)

    # Avisa o Player 2
    await sio.emit('match_found', {
        'room_id': room_id,
        'opponentName': rooms[room_id]['names'][p1_sid],
        'mySymbol': rooms[room_id]['symbols'][p2_sid],
        'board': board,
        'turn': 'X'
    }, room=p2_sid)

@sio.event
async def make_move(sid, data):
    """Jogador tentou responder uma casa do Jogo da Velha"""
    room_id = data.get('room_id')
    cell_index = data.get('cellIndex')
    resposta = data.get('resposta')

    if room_id not in rooms: return
    room = rooms[room_id]
    
    my_symbol = room['symbols'][sid]
    
    # Validações de segurança
    if room['turn'] != my_symbol: return # Não é a vez dele
    if room['board'][cell_index]['marcadoPor'] is not None: return # Já marcada

    acertou = (int(resposta) == room['board'][cell_index]['resposta'])

    if acertou:
        room['board'][cell_index]['marcadoPor'] = my_symbol
        ganhador = check_win(room['board'])
        
        if ganhador:
            await sio.emit('game_over', {'ganhador': ganhador, 'board': room['board']}, room=room_id)
            del rooms[room_id]
            return
        else:
            # Passa a vez
            room['turn'] = 'O' if my_symbol == 'X' else 'X'
    else:
        # Errou a conta! Perde vida e passa a vez.
        room['vidas'][sid] -= 1
        
        if room['vidas'][sid] <= 0:
            ganhador = 'O' if my_symbol == 'X' else 'X'
            await sio.emit('game_over', {'ganhador': ganhador, 'board': room['board']}, room=room_id)
            del rooms[room_id]
            return
        else:
            # Passa a vez após o erro
            room['turn'] = 'O' if my_symbol == 'X' else 'X'

    # Se não acabou o jogo, atualiza a tela dos dois jogadores
    await sio.emit('board_update', {
        'board': room['board'],
        'turn': room['turn'],
        'vidas': room['vidas']
    }, room=room_id)

@sio.event
async def leave_match(sid, data):
    room_id = data.get('room_id')
    if room_id in rooms:
        other_sid = [p for p in rooms[room_id]['players'] if p != sid][0]
        await sio.emit('opponent_disconnected', {}, room=other_sid)
        del rooms[room_id]

# Export socket app
app = socketio.ASGIApp(sio)
