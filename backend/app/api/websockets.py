"""WebSocket endpoints for real-time collaboration"""
from flask import Blueprint, request
from flask_socketio import emit, join_room, leave_room
from flask_jwt_extended import decode_token
from ..extensions import socketio

ws_bp = Blueprint('websockets', __name__)

# In-memory store of connected users per document
document_rooms = {}

@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    token = request.args.get('token')
    if not token:
        return False
    
    try:
        # Verify JWT token
        decoded = decode_token(token)
        user_id = decoded['sub']
        user_name = decoded.get('name') or decoded.get('email') or f'User {user_id}'
        
        # Store user info in session
        from flask import session
        session['user_id'] = user_id
        session['user_name'] = user_name
        
        emit('connected', {'status': 'connected', 'user_id': user_id, 'user_name': user_name})
        return True
        
    except Exception as e:
        print(f"Connection failed: {e}")
        return False

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    from flask import session
    user_id = session.get('user_id')
    user_name = session.get('user_name')
    
    # Remove user from all rooms
    for room, users in document_rooms.items():
        if user_id in users:
            users.pop(user_id, None)
            leave_room(room)
            emit('user_left', {
                'user_id': user_id,
                'user_name': user_name,
                'document_id': room
            }, room=room)

@socketio.on('join_document')
def handle_join_document(data):
    """User joins a document editing session"""
    from flask import session
    
    user_id = session.get('user_id')
    user_name = session.get('user_name')
    doc_id = data.get('document_id')
    
    if not user_id or not doc_id:
        return
    
    room = f"document_{doc_id}"
    join_room(room)
    
    # Track users in room
    if room not in document_rooms:
        document_rooms[room] = {}
    document_rooms[room][user_id] = user_name
    
    # Notify others
    emit('user_joined', {
        'user_id': user_id,
        'user_name': user_name,
        'document_id': doc_id,
        'active_users': len(document_rooms[room]),
        'users': [
            {'user_id': room_user_id, 'user_name': room_user_name}
            for room_user_id, room_user_name in document_rooms[room].items()
        ]
    }, room=room)

@socketio.on('leave_document')
def handle_leave_document(data):
    """User leaves a document editing session"""
    from flask import session
    
    user_id = session.get('user_id')
    user_name = session.get('user_name')
    doc_id = data.get('document_id')
    
    if not user_id or not doc_id:
        return
    
    room = f"document_{doc_id}"
    leave_room(room)
    
    if room in document_rooms:
        document_rooms[room].pop(user_id, None)
    
    emit('user_left', {
        'user_id': user_id,
        'user_name': user_name,
        'document_id': doc_id
    }, room=room)

@socketio.on('cursor_move')
def handle_cursor_move(data):
    """Broadcast cursor position to other users"""
    from flask import session
    
    user_id = session.get('user_id')
    user_name = session.get('user_name')
    doc_id = data.get('document_id')
    
    if not user_id or not doc_id:
        return
    
    room = f"document_{doc_id}"
    
    emit('cursor_update', {
        'user_id': user_id,
        'user_name': user_name,
        'position': data.get('position'),
        'selection': data.get('selection')
    }, room=room, include_self=False)

@socketio.on('typing_status')
def handle_typing_status(data):
    """Broadcast typing status"""
    from flask import session
    
    user_id = session.get('user_id')
    user_name = session.get('user_name')
    doc_id = data.get('document_id')
    
    if not user_id or not doc_id:
        return
    
    room = f"document_{doc_id}"
    
    emit('user_typing', {
        'user_id': user_id,
        'user_name': user_name,
        'is_typing': data.get('is_typing', False)
    }, room=room, include_self=False)


@socketio.on('content_change')
def handle_content_change(data):
    """Broadcast draft content to other users in the same document."""
    from flask import session

    user_id = session.get('user_id')
    user_name = session.get('user_name')
    doc_id = data.get('document_id')

    if not user_id or not doc_id:
        return

    room = f"document_{doc_id}"

    emit('content_update', {
        'user_id': user_id,
        'user_name': user_name,
        'document_id': doc_id,
        'content': data.get('content', ''),
        'is_draft': True
    }, room=room, include_self=False)
