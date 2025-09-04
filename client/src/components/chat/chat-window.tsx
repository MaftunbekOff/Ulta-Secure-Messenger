import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { MessageBubble } from './message-bubble';
import { MessageInput } from './message-input';
import { LoadingSpinner } from './LoadingSpinner';
import { useWebSocket } from '../../hooks/useWebSocket';

interface Message {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  timestamp: number;
  chatId: string;
  encrypted?: boolean;
  messageType?: 'text' | 'image' | 'file' | 'system';
  deliveryStatus?: 'sending' | 'sent' | 'delivered' | 'read';
}

interface ChatWindowProps {
  chatId: string;
  currentUserId: string;
  currentUserName: string;
}

export function ChatWindow({ chatId, currentUserId, currentUserName }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // WebSocket connection
  const { 
    socket, 
    sendMessage: wsSendMessage, 
    connected: wsConnected,
    error: wsError 
  } = useWebSocket(currentUserId);

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load chat messages on mount
  useEffect(() => {
    loadChatMessages();
  }, [chatId]);

  // Handle WebSocket connection status
  useEffect(() => {
    setIsConnected(wsConnected);
    if (wsError) {
      setError(`Connection error: ${wsError}`);
    }
  }, [wsConnected, wsError]);

  // Set up message handler for WebSocket
  useEffect(() => {
    if (!socket) return;

    // Define message handler function
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'message' && data.chatId === chatId) {
          const newMessage: Message = {
            id: data.messageId || `msg_${Date.now()}_${Math.random()}`,
            content: data.content,
            senderId: data.userId || data.senderId,
            senderName: data.senderName || 'Unknown User',
            timestamp: data.timestamp || Date.now(),
            chatId: data.chatId,
            encrypted: data.encrypted,
            messageType: data.messageType || 'text',
            deliveryStatus: 'delivered'
          };

          setMessages(prev => [...prev, newMessage]);
          scrollToBottom();
        }
      } catch (error) {
        console.warn('Failed to parse WebSocket message:', error);
      }
    };

    // Add event listener
    socket.addEventListener('message', handleMessage);

    // Cleanup
    return () => {
      socket.removeEventListener('message', handleMessage);
    };
  }, [socket, chatId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load chat messages from API
  const loadChatMessages = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/chats/${chatId}/messages`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.messages && Array.isArray(data.messages)) {
        const formattedMessages: Message[] = data.messages.map((msg: any) => ({
          id: msg.id,
          content: msg.content,
          senderId: msg.senderId,
          senderName: msg.senderName || 'Unknown User',
          timestamp: msg.timestamp,
          chatId: msg.chatId,
          encrypted: msg.encrypted,
          messageType: msg.messageType || 'text',
          deliveryStatus: 'delivered'
        }));

        setMessages(formattedMessages);
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
      setError(`Failed to load messages: ${error.message}`);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle sending new message
  const handleSendMessage = async (content: string) => {
    if (!content.trim() || !isConnected) {
      return;
    }

    const tempMessage: Message = {
      id: `temp_${Date.now()}_${Math.random()}`,
      content,
      senderId: currentUserId,
      senderName: currentUserName,
      timestamp: Date.now(),
      chatId,
      messageType: 'text',
      deliveryStatus: 'sending'
    };

    // Add temporary message to UI
    setMessages(prev => [...prev, tempMessage]);
    scrollToBottom();

    try {
      // Send via WebSocket if connected
      if (wsSendMessage) {
        await wsSendMessage({
          type: 'message',
          content,
          chatId,
          userId: currentUserId,
          senderName: currentUserName,
          timestamp: Date.now(),
          messageId: tempMessage.id
        });

        // Update message status
        setMessages(prev => prev.map(msg => 
          msg.id === tempMessage.id 
            ? { ...msg, deliveryStatus: 'sent' }
            : msg
        ));
      } else {
        // Fallback to HTTP API
        const response = await fetch(`/api/chats/${chatId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content,
            senderId: currentUserId,
            senderName: currentUserName,
            messageType: 'text'
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        // Update with real message ID
        setMessages(prev => prev.map(msg => 
          msg.id === tempMessage.id 
            ? { ...msg, id: result.messageId, deliveryStatus: 'sent' }
            : msg
        ));
      }
    } catch (error) {
      console.error('Failed to send message:', error);

      // Mark message as failed
      setMessages(prev => prev.map(msg => 
        msg.id === tempMessage.id 
          ? { ...msg, deliveryStatus: 'sending', content: `❌ ${msg.content}` }
          : msg
      ));

      setError(`Failed to send message: ${error.message}`);
    }
  };

  // Retry connection
  const retryConnection = () => {
    setError(null);
    window.location.reload();
  };

  if (loading) {
    return (
      <Card className="flex-1 flex items-center justify-center">
        <CardContent>
          <LoadingSpinner />
          <p className="mt-4 text-center text-muted-foreground">Loading messages...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Connection Status */}
      {!isConnected && (
        <div className="bg-yellow-100 dark:bg-yellow-900/20 p-2 text-center text-sm">
          <span className="text-yellow-800 dark:text-yellow-200">
            ⚠️ Connection issues - messages may not be real-time
          </span>
          <Button
            variant="link"
            size="sm"
            className="ml-2 h-auto p-0 text-yellow-800 dark:text-yellow-200"
            onClick={retryConnection}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-100 dark:bg-red-900/20 p-3 text-center">
          <span className="text-red-800 dark:text-red-200">{error}</span>
          <Button
            variant="link"
            size="sm"
            className="ml-2 h-auto p-0 text-red-800 dark:text-red-200"
            onClick={() => setError(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Messages Area */}
      <Card className="flex-1 flex flex-col">
        <CardContent className="flex-1 flex flex-col p-4">
          <div className="flex-1 overflow-y-auto space-y-4 mb-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <p className="text-lg mb-2">No messages yet</p>
                  <p className="text-sm">Start a conversation!</p>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isOwn={message.senderId === currentUserId}
                  showSender={true}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <MessageInput
            onSendMessage={handleSendMessage}
            disabled={!isConnected}
            placeholder={isConnected ? "Type a message..." : "Connecting..."}
          />
        </CardContent>
      </Card>
    </div>
  );
}