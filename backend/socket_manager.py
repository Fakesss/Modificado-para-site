import asyncio
from typing import Dict, List, Optional
from datetime import datetime
import socketio
import random

# Socket.IO Manager para multiplayer
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=True,
    engineio_logger=True
)

# Estruturas de dados
players_online: Dict[str, dict] = {}  # sid -> player_info
rooms: Dict[str, dict] = {}  # room_id -> room_info
invites: Dict[str, dict] = {}  # invite_id -> invite_info

class GameRoom:
    def __init__(self, room_id: str, player1_sid: str, player2_sid: str):
        self.room_id = room_id
        self.players = {player1_sid, player2_sid}
        self.scores = {player1_sid: 0, player2_sid: 0}
        self.operations = []
        self.started = False
        self.created_at = datetime.now()

@sio.event
async def connect(sid, environ):
    print(f'Client connected: {sid}')
    await sio.emit('connected', {'sid': sid}, room=sid)

@sio.event
async def disconnect(sid):
    print(f'Client disconnected: {sid}')
    
    # Remove from online players
    if sid in players_online:
        player_name = players_online[sid].get('name', 'Unknown')
        del players_online[sid]
        
        # Notify others
        await sio.emit('player_left', {
            'sid': sid,
            'name': player_name
        })
    
    # Handle room cleanup
    for room_id, room in list(rooms.items()):
        if sid in room['players']:
            # Notify other player
            other_sid = [p for p in room['players'] if p != sid][0]
            await sio.emit('opponent_left', {}, room=other_sid)
            del rooms[room_id]
            break

@sio.event
async def join_lobby(sid, data):
    """Player joins the multiplayer lobby"""
    player_info = {
        'sid': sid,
        'name': data.get('name', 'Player'),
        'user_id': data.get('user_id'),
        'joined_at': datetime.now().isoformat()
    }
    
    players_online[sid] = player_info
    
    # Send current players list to new player
    players_list = [
        {'sid': s, 'name': info['name']} 
        for s, info in players_online.items() 
        if s != sid
    ]
    
    await sio.emit('lobby_joined', {
        'players': players_list
    }, room=sid)
    
    # Notify others about new player
    await sio.emit('player_joined', {
        'sid': sid,
        'name': player_info['name']
    }, skip_sid=sid)

@sio.event
async def leave_lobby(sid, data):
    """Player leaves the lobby"""
    if sid in players_online:
        del players_online[sid]
    
    await sio.emit('player_left', {'sid': sid})

@sio.event
async def send_invite(sid, data):
    """Send game invite to another player"""
    target_sid = data.get('target_sid')
    
    if target_sid not in players_online:
        await sio.emit('invite_error', {
            'message': 'Player not available'
        }, room=sid)
        return
    
    invite_id = f"{sid}_{target_sid}_{int(datetime.now().timestamp())}"
    
    invites[invite_id] = {
        'from_sid': sid,
        'to_sid': target_sid,
        'from_name': players_online[sid]['name'],
        'created_at': datetime.now()
    }
    
    # Send invite to target player
    await sio.emit('game_invite', {
        'invite_id': invite_id,
        'from_sid': sid,
        'from_name': players_online[sid]['name']
    }, room=target_sid)
    
    # Confirm to sender
    await sio.emit('invite_sent', {
        'invite_id': invite_id,
        'to_name': players_online[target_sid]['name']
    }, room=sid)

@sio.event
async def accept_invite(sid, data):
    """Accept game invite and create room"""
    invite_id = data.get('invite_id')
    
    if invite_id not in invites:
        await sio.emit('invite_error', {
            'message': 'Invite expired'
        }, room=sid)
        return
    
    invite = invites[invite_id]
    player1_sid = invite['from_sid']
    player2_sid = sid
    
    # Create room
    room_id = f"room_{player1_sid[:8]}_{player2_sid[:8]}"
    
    rooms[room_id] = {
        'room_id': room_id,
        'players': [player1_sid, player2_sid],
        'scores': {player1_sid: 0, player2_sid: 0},
        'started': False,
        'operations': [],
        'created_at': datetime.now().isoformat()
    }
    
    # Add both players to socket.io room
    await sio.enter_room(player1_sid, room_id)
    await sio.enter_room(player2_sid, room_id)
    
    # Notify both players
    await sio.emit('game_starting', {
        'room_id': room_id,
        'opponent_name': players_online[player2_sid]['name']
    }, room=player1_sid)
    
    await sio.emit('game_starting', {
        'room_id': room_id,
        'opponent_name': players_online[player1_sid]['name']
    }, room=player2_sid)
    
    # Clean up invite
    del invites[invite_id]
    
    # Start game after 3 seconds
    await asyncio.sleep(3)
    await start_multiplayer_game(room_id)

@sio.event
async def decline_invite(sid, data):
    """Decline game invite"""
    invite_id = data.get('invite_id')
    
    if invite_id in invites:
        invite = invites[invite_id]
        
        # Notify sender
        await sio.emit('invite_declined', {
            'by_name': players_online[sid]['name']
        }, room=invite['from_sid'])
        
        del invites[invite_id]

async def start_multiplayer_game(room_id: str):
    """Start multiplayer game with synchronized operations"""
    if room_id not in rooms:
        return
    
    room = rooms[room_id]
    room['started'] = True
    
    # Generate initial operations (synchronized)
    operations = generate_operations(3)
    room['operations'] = operations
    
    # Send to both players
    await sio.emit('game_start', {
        'operations': operations,
        'room_id': room_id
    }, room=room_id)

def generate_operations(count: int) -> List[dict]:
    """Generate random math operations"""
    operations = []
    operators = ['+', '-', '×', '÷']
    
    for _ in range(count):
        op = random.choice(operators)
        
        if op == '+':
            num1 = random.randint(1, 50)
            num2 = random.randint(1, 50)
            answer = num1 + num2
        elif op == '-':
            num1 = random.randint(10, 50)
            num2 = random.randint(1, num1)
            answer = num1 - num2
        elif op == '×':
            num1 = random.randint(1, 12)
            num2 = random.randint(1, 12)
            answer = num1 * num2
        else:  # ÷
            num2 = random.randint(1, 12)
            answer = random.randint(1, 12)
            num1 = num2 * answer
        
        operations.append({
            'id': f"op_{random.randint(1000, 9999)}",
            'num1': num1,
            'num2': num2,
            'operator': op,
            'answer': answer
        })
    
    return operations

@sio.event
async def player_answer(sid, data):
    """Player submits an answer"""
    room_id = data.get('room_id')
    answer = data.get('answer')
    operation_id = data.get('operation_id')
    
    if room_id not in rooms:
        return
    
    room = rooms[room_id]
    
    # Find operation
    operation = next((op for op in room['operations'] if op['id'] == operation_id), None)
    
    if operation and operation['answer'] == answer:
        # Correct answer
        room['scores'][sid] += 10
        
        # Remove operation from room
        room['operations'] = [op for op in room['operations'] if op['id'] != operation_id]
        
        # Notify both players
        await sio.emit('answer_correct', {
            'player_sid': sid,
            'operation_id': operation_id,
            'scores': room['scores']
        }, room=room_id)
        
        # Add new operation if needed
        if len(room['operations']) < 5:
            new_ops = generate_operations(1)
            room['operations'].extend(new_ops)
            
            await sio.emit('new_operations', {
                'operations': new_ops
            }, room=room_id)
    else:
        # Wrong answer
        await sio.emit('answer_wrong', {
            'player_sid': sid
        }, room=room_id)

@sio.event
async def voice_state(sid, data):
    """Handle voice chat state changes"""
    room_id = data.get('room_id')
    muted = data.get('muted', False)
    
    if room_id in rooms:
        # Notify other player
        await sio.emit('opponent_voice_state', {
            'muted': muted
        }, room=room_id, skip_sid=sid)

@sio.event
async def leave_game(sid, data):
    """Player leaves the game"""
    room_id = data.get('room_id')
    
    if room_id in rooms:
        # Notify other player
        await sio.emit('opponent_left', {}, room=room_id, skip_sid=sid)
        
        # Clean up room
        del rooms[room_id]

# Export socket app
app = socketio.ASGIApp(sio)