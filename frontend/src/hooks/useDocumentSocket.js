import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './useAuth';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:5000';

export const useDocumentSocket = (docId) => {
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [activeUsers, setActiveUsers] = useState(0);
  const [cursors, setCursors] = useState({});
  const [typingUsers, setTypingUsers] = useState(new Set());
  
  const socketRef = useRef(null);
  
  useEffect(() => {
    if (!docId || !user) return;
    
    const token = localStorage.getItem('access_token');
    if (!token) return;
    
    // Connect to WebSocket
    const socket = io(WS_URL, {
      query: { token },
      transports: ['websocket'],
    });
    
    socketRef.current = socket;
    
    socket.on('connect', () => {
      console.log('WebSocket connected');
      setConnected(true);
      socket.emit('join_document', { document_id: docId });
    });
    
    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    });
    
    socket.on('user_joined', (data) => {
      console.log('User joined:', data);
      setActiveUsers(data.active_users);
    });
    
    socket.on('user_left', (data) => {
      console.log('User left:', data);
      setActiveUsers(prev => Math.max(0, prev - 1));
      
      // Remove user's cursor
      setCursors(prev => {
        const newCursors = { ...prev };
        delete newCursors[data.user_id];
        return newCursors;
      });
    });
    
    socket.on('cursor_update', (data) => {
      setCursors(prev => ({
        ...prev,
        [data.user_id]: {
          position: data.position,
          selection: data.selection,
          timestamp: Date.now()
        }
      }));
    });
    
    socket.on('user_typing', (data) => {
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        if (data.is_typing) {
          newSet.add(data.user_id);
        } else {
          newSet.delete(data.user_id);
        }
        return newSet;
      });
    });
    
    return () => {
      socket.emit('leave_document', { document_id: docId });
      socket.disconnect();
    };
  }, [docId, user]);
  
  const sendCursorPosition = (position, selection = null) => {
    if (socketRef.current && connected) {
      socketRef.current.emit('cursor_move', {
        document_id: docId,
        position,
        selection
      });
    }
  };
  
  const sendTypingStatus = (isTyping) => {
    if (socketRef.current && connected) {
      socketRef.current.emit('typing_status', {
        document_id: docId,
        is_typing: isTyping
      });
    }
  };
  
  return {
    connected,
    activeUsers,
    cursors,
    typingUsers,
    sendCursorPosition,
    sendTypingStatus
  };
};