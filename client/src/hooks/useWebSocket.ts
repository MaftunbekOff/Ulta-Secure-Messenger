import { useEffect, useRef, useState, useCallback } from "react";
import { getAuthToken } from "@/lib/authUtils";

// Mock useAuth hook for standalone execution
const useAuth = () => {
  return { token: getAuthToken() };
};

interface WebSocketMessage {
  type: 'message' | 'typing' | 'user_online' | 'user_offline' | 'connected' | 'error' | 'join_chat' | 'leave_chat' | 'authenticate';
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
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const { token } = useAuth();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionAttemptRef = useRef<boolean>(false);
  const maxReconnectAttempts = 5;

  // Placeholder for messages state if it were managed within this hook
  // For the provided changes, it seems messages are managed externally,
  // but the decryption logic implies a messages state.
  // We'll add a placeholder `setMessages` to make the changes compile.
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);

  const connectWebSocket = useCallback(async () => {
    if (!token || connectionAttemptRef.current) {
      return;
    }

    connectionAttemptRef.current = true;

    try {
      // Clear any existing timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Close existing connection if any
      if (socket) {
        socket.close();
        setSocket(null);
      }

      // Use the correct WebSocket URL for the current environment
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws`;

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        setReconnectAttempts(0);
        connectionAttemptRef.current = false;

        // Send authentication token immediately
        ws.send(JSON.stringify({
          type: 'authenticate',
          token: token,
          timestamp: new Date().toISOString()
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);
          // Call the message handler to potentially decrypt
          handleMessage(event);
        } catch (error) {
          console.warn('Failed to parse WebSocket message:', event.data);
        }
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        setSocket(null);
        connectionAttemptRef.current = false;

        // Only attempt reconnect if it wasn't a manual close and we haven't exceeded max attempts
        if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts && token) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);

          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connectWebSocket();
          }, delay);
        }
      };

      ws.onerror = () => {
        setIsConnected(false);
        connectionAttemptRef.current = false;
      };

      setSocket(ws);

    } catch (error) {
      connectionAttemptRef.current = false;
      setIsConnected(false);

      // Retry with exponential backoff
      if (reconnectAttempts < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        reconnectTimeoutRef.current = setTimeout(() => {
          setReconnectAttempts(prev => prev + 1);
          connectWebSocket();
        }, delay);
      }
    }
  }, [token, socket, reconnectAttempts]);

  useEffect(() => {
    if (token && !socket && !connectionAttemptRef.current) {
      connectWebSocket();
    }

    return () => {
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
  }, [token]);

  const sendMessage = useCallback(async (message: Omit<WebSocketMessage, 'timestamp'>) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        // Import encryption functions
        const { encryptMessage, isMilitaryEncryptionAvailable } = await import('../lib/militaryEncryption');

        let messageToSend = message.content;

        // Use military-grade encryption if available
        if (isMilitaryEncryptionAvailable() && message.type === 'message') {
          // For demo, we'll use a default public key or implement key exchange
          // The actual encryption logic will be in encryptMessage function
          if (messageToSend) {
            messageToSend = encryptMessage(messageToSend);
          }
        }

        socket.send(JSON.stringify({
          ...message,
          content: messageToSend,
          timestamp: new Date().toISOString(),
        }));
      } catch (error) {
        console.warn('Failed to send WebSocket message:', error);
        setIsConnected(false);
      }
    } else if (token && !connectionAttemptRef.current) {
      // Try to reconnect if not already attempting
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

  // This handler is added to support the decryption logic from the changes.
  // It's assumed that `setMessages` is available in the context where `useWebSocket` is used.
  const handleMessage = useCallback(async (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === 'new_message') {
        // Decrypt message content
        try {
          // Import decryption function. Note: the path in the original change snippet was incorrect.
          // Assuming 'militaryEncryption' is a module that exports both encrypt and decrypt.
          const { decrypt } = await import('../lib/militaryEncryption');
          const decryptedContent = decrypt(data.message.content);

          setMessages(prev => [...prev, {
            ...data.message,
            content: decryptedContent
          }]);
        } catch (decryptError) {
          console.error('Decryption error:', decryptError);
          // Show encrypted message indicator if decryption fails
          setMessages(prev => [...prev, {
            ...data.message,
            content: '[Encrypted Message]'
          }]);
        }
      } else if (data.type === 'error') {
        console.error('WebSocket server error:', data.message);
      } else {
        // Handle other message types if necessary, or log them.
        setLastMessage(data);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }, [setMessages]); // Dependency array includes setMessages


  return {
    isConnected,
    lastMessage,
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
      if (socket) {
        socket.close(1000, 'Manual disconnect');
        setSocket(null);
      }
      setIsConnected(false);
      setReconnectAttempts(0);
    },
  };
}