import { useEffect, useRef, useState, useCallback } from "react";
import { getAuthToken } from "@/lib/authUtils";

// Mock useAuth hook for standalone execution
const useAuth = () => {
  return { token: getAuthToken() };
};

interface WebSocketMessage {
  type: 'message' | 'typing' | 'user_online' | 'user_offline' | 'connected' | 'error' | 'join_chat' | 'leave_chat';
  chatId?: string;
  content?: string;
  senderId?: string;
  messageId?: string;
  timestamp?: string;
  userId?: string;
  message?: string;
  token?: string;
}

// Mock message cache for demonstration
const messageCache = {
  store: (chatId: string, messages: WebSocketMessage[]) => {
    console.log(`Caching ${messages.length} messages for chat ${chatId}`);
    // In a real app, this would be a more sophisticated cache
  },
};

export function useWebSocket() {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const { token } = useAuth();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionAttemptRef = useRef<boolean>(false);
  const maxReconnectAttempts = 3;
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const ws = useRef<WebSocket | null>(null); // Use ref for WebSocket instance
  const setConnected = setIsConnected; // Alias for clarity
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');

  // Add status indicator to DOM for performance monitoring
  const addStatusIndicator = () => {
    let indicator = document.querySelector('[data-websocket-status]') as HTMLElement;
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.setAttribute('data-websocket-status', 'disconnected');
      indicator.style.display = 'none'; // Keep hidden, for potential debugging
      document.body.appendChild(indicator);
    }
    return indicator;
  };

  const getWebSocketUrl = () => {
    if (typeof window === 'undefined') return 'ws://0.0.0.0:8080/ws';

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const hostname = window.location.hostname;

    // Replit environment detection (comprehensive)
    if (hostname.includes('replit.dev') ||
        hostname.includes('replit.co') ||
        hostname.includes('replit.app') ||
        hostname.includes('replit.com') ||
        hostname.includes('.repl.') ||
        hostname.endsWith('.repl')) {
      // Replit production environment - port 8080 bilan
      const port = window.location.port || '8080';
      return `${protocol}//${hostname}:8080/ws`;
    }

    // Development rejimi
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `ws://0.0.0.0:8080/ws`;
    }

    // Default fallback
    return `${protocol}//${hostname}:8080/ws`;
  };


  const connectWebSocket = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;

    try {
      const wsUrl = getWebSocketUrl();
      console.log('🔗 Connecting to WebSocket:', wsUrl);

      // Ultra-fast WebSocket setup
      ws.current = new WebSocket(wsUrl);
      ws.current.binaryType = 'arraybuffer'; // Faster binary handling

      ws.current.onopen = () => {
        console.log('✅ WebSocket ulanish muvaffaqiyatli');
        setConnected(true);
        setError(null);
        setReconnectAttempts(0);
        setConnectionStatus('connected');

        // Connection established successfully
      };

      ws.current.onmessage = (event) => {
        try {
          // Ultra-fast message parsing with minimal overhead
          const message = JSON.parse(event.data);

          // Instant message processing without blocking UI
          requestAnimationFrame(() => {
            setLastMessage(message);
          });

          // Cache message for instant retrieval
          if (message.type === 'message' && message.chatId) {
            messageCache.store(message.chatId, [message]);
          }
        } catch (error) {
          console.error('WebSocket xabarni parse qilishda xato:', error);
        }
      };

      ws.current.onclose = (event) => {
        console.log('WebSocket ulanish yopildi:', event.code, event.reason);
        setConnected(false);
        setConnectionStatus('disconnected');
        
        // Auto-reconnect if connection was established before
        if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
          setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connectWebSocket();
          }, 2000);
        }
        setIsConnecting(false);
        setConnectionStatus('disconnected');

        // Faqat development muhitida log qilish
        if (process.env.NODE_ENV === 'development') {
          console.log('WebSocket ulanish yopildi:', event.code, event.reason);
        }

        // Qayta ulanishga harakat qilish (faqat kutilmagan yopilishda)
        if (!event.wasClean && reconnectAttempts < maxReconnectAttempts) {
          const timeout = Math.min(Math.pow(2, reconnectAttempts) * 1000, 30000); // Max 30s
          setReconnectAttempts(prev => prev + 1);

          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, timeout);
        } else if (reconnectAttempts >= maxReconnectAttempts) {
          setError('HTTP polling rejimida ishlayabdi');
          // HTTP polling rejimiga o'tish - console spam yo'q
        }
      };

      ws.current.onerror = (event) => {
        setError('WebSocket ulanish xatosi');
        setIsConnecting(false);
        setConnectionStatus('error');
        // Log only in development
        if (process.env.NODE_ENV === 'development') {
          console.debug('WebSocket error:', event);
        }
      };

      setSocket(ws.current);
    } catch (error) {
      setError('HTTP polling rejimida ishlayabdi');
      setIsConnecting(false);
      setConnectionStatus('error');
      // Silent error handling - no console spam
    }
  }, [isConnecting, reconnectAttempts, maxReconnectAttempts]); // Removed socket from dependencies

  useEffect(() => {
    // Initially attempt to connect when the component mounts
    connectWebSocket();

    return () => {
      // Cleanup on unmount
      connectionAttemptRef.current = false;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (ws.current) {
        ws.current.close(1000, 'Component cleanup');
        ws.current = null; // Clear the ref
      }
      setSocket(null);
      setIsConnected(false); // Ensure connection status is false on unmount
      setConnectionStatus('disconnected');
    };
  }, [connectWebSocket]); // Depend on connectWebSocket to ensure it's stable

  const sendMessage = useCallback((content: string) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      try {
        const message = {
          type: 'message' as const,
          content,
          timestamp: new Date().toISOString(),
          messageId: Date.now().toString()
        };
        ws.current.send(JSON.stringify(message));
        console.log('✅ Xabar yuborildi:', content.substring(0, 50));
      } catch (error) {
        console.error('❌ WebSocket send xato:', error);
        // Don't clear connection immediately, let onclose handle it
      }
    } else {
      console.warn('⚠️ WebSocket is not open, attempting to reconnect...');
      if (token && !connectionAttemptRef.current) {
        connectWebSocket();
      }
    }
  }, [token, connectWebSocket]);

  const joinChat = useCallback((chatId: string) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN && token) {
      try {
        const message = { type: 'join_chat' as const, chatId, token };
        ws.current.send(JSON.stringify(message));
      } catch (error) {
        console.error('Join chat xato:', error);
      }
    }
  }, [token]);

  const leaveChat = useCallback((chatId: string) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      try {
        const message = { type: 'leave_chat' as const, chatId };
        ws.current.send(JSON.stringify(message));
      } catch (error) {
        console.error('Leave chat xato:', error);
      }
    }
  }, []);

  const sendTyping = useCallback((chatId: string) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      try {
        const message = { type: 'typing' as const, chatId };
        ws.current.send(JSON.stringify(message));
      } catch (error) {
        console.error('Send typing xato:', error);
      }
    }
  }, []);

  return {
    socket,
    lastMessage,
    isConnected,
    connectionStatus,
    sendMessage,
    joinChat,
    leaveChat,
    sendTyping,
    connect: connectWebSocket,
    disconnect: () => {
      connectionAttemptRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (ws.current) {
        ws.current.close(1000, 'Manual disconnect');
        ws.current = null; // Clear the ref
      }
      setSocket(null);
      setIsConnected(false);
      setReconnectAttempts(0);
      setConnectionStatus('disconnected');
    },
  };
}