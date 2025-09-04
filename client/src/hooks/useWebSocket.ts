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

export function useWebSocket() {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const { token } = useAuth();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionAttemptRef = useRef<boolean>(false);
  const maxReconnectAttempts = 3;

  const connectWebSocket = useCallback(async () => {
    // WebSocket disabled - using HTTP polling for better stability
    console.log('WebSocket disabled, using HTTP polling');
    return;
  }, []);

  // Dummy function to maintain compatibility
  const dummyTimeout = useCallback(() => {
  }, []);


  useEffect(() => {
    // Only connect if we have a token and no active connection
    if (token && !socket) {
      connectWebSocket();
    }

    return () => {
      // Cleanup on unmount
      connectionAttemptRef.current = false;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (socket) {
        socket.close(1000, 'Component cleanup');
        setSocket(null);
      }
    };
  }, [token]); // Only depend on token

  const sendMessage = useCallback((message: Omit<WebSocketMessage, 'timestamp'>) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify({
          ...message,
          timestamp: new Date().toISOString(),
        }));
      } catch (error) {
        // Silent error handling
        setIsConnected(false);
      }
    } else if (token && !connectionAttemptRef.current) {
      // Try to reconnect only if not already attempting
      connectWebSocket();
    }
  }, [socket, token, connectWebSocket]);

  const joinChat = useCallback((chatId: string) => {
    if (token) {
      sendMessage({ type: 'join_chat', chatId, token });
    }
  }, [sendMessage, token]);

  const leaveChat = useCallback((chatId: string) => {
    sendMessage({ type: 'leave_chat', chatId });
  }, [sendMessage]);

  const sendTyping = useCallback((chatId: string) => {
    sendMessage({ type: 'typing', chatId });
  }, [sendMessage]);

  return {
    isConnected,
    lastMessage: null, // This was removed as it was not used in the provided snippet
    sendMessage,
    joinChat,
    leaveChat,
    sendTyping,
    connect: connectWebSocket, // Renamed to connect for consistency with original
    disconnect: () => {
      connectionAttemptRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (socket) {
        socket.close(1000, 'Manual disconnect');
        setSocket(null);
      }
      setIsConnected(false);
      setReconnectAttempts(0);
    },
  };
}