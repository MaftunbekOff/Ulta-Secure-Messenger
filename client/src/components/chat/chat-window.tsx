import React, { useState, useEffect } from 'react';
import { MessageBubble } from './message-bubble';
import { MessageInput } from './message-input';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, Wifi, WifiOff } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  userId: string;
  timestamp: Date;
  encrypted?: boolean;
}

interface ChatWindowProps {
  chatId?: string;
  currentUserId?: string;
}

export default function ChatWindow({ chatId = 'default', currentUserId = 'user1' }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const { 
    isConnected, 
    sendMessage, 
    lastMessage,
    connectionStatus 
  } = useWebSocket();

  // Handle incoming messages
  useEffect(() => {
    if (lastMessage) {
      try {
        const messageData = typeof lastMessage === 'string' 
          ? JSON.parse(lastMessage) 
          : lastMessage;

        if (messageData.type === 'message') {
          const newMessage: Message = {
            id: messageData.messageId || Date.now().toString(),
            content: messageData.content || messageData.message,
            userId: messageData.userId || 'other',
            timestamp: new Date(messageData.timestamp || Date.now()),
            encrypted: messageData.encrypted || true
          };

          setMessages(prev => [...prev, newMessage]);
        }
      } catch (error) {
        console.warn('Failed to parse message:', error);
      }
    }
  }, [lastMessage]);

  // Add some demo messages on load
  useEffect(() => {
    const demoMessages: Message[] = [
      {
        id: '1',
        content: 'UltraSecure Messenger ga xush kelibsiz! 🛡️',
        userId: 'system',
        timestamp: new Date(),
        encrypted: true
      }
    ];
    setMessages(demoMessages);
  }, []);

  const handleSendMessage = (content: string) => {
    if (!isConnected) {
      console.warn('WebSocket not connected');
      return;
    }

    const message = {
      type: 'message' as const,
      chatId,
      content,
      messageId: Date.now().toString(),
      userId: currentUserId,
      timestamp: new Date().toISOString()
    };

    // Add to local messages immediately
    const localMessage: Message = {
      id: message.messageId,
      content: message.content,
      userId: message.userId,
      timestamp: new Date(),
      encrypted: true
    };

    setMessages(prev => [...prev, localMessage]);

    // Send via WebSocket
    sendMessage(message);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0 pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-500" />
            <span>UltraSecure Chat</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {isConnected ? (
              <>
                <Wifi className="h-4 w-4 text-green-500" />
                <span className="text-green-500">Ulangan</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-red-500" />
                <span className="text-red-500">Ulanmagan</span>
              </>
            )}
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-4 py-4">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={{
                  ...message,
                  senderId: message.userId,
                  timestamp: message.timestamp.getTime(),
                  isEncrypted: message.encrypted
                }}
                isOwn={message.userId === currentUserId}
                senderName={message.userId === 'system' ? 'System' : `User ${message.userId}`}
              />
            ))}
          </div>
        </ScrollArea>

        <div className="border-t">
          <MessageInput
            onSendMessage={handleSendMessage}
            disabled={!isConnected}
          />
        </div>
      </CardContent>
    </Card>
  );
}