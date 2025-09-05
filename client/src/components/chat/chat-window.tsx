import React, { useState, useEffect } from 'react';
import { MessageBubble } from './message-bubble';
import { MessageInput } from './message-input';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, Wifi, WifiOff, ArrowLeft, User, Settings } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import DevPanel from '@/components/dev/dev-panel';

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
  selectedChat?: {
    id: string;
    name?: string;
    isGroup: boolean;
    otherUser?: {
      id: string;
      username: string;
      firstName?: string;
      lastName?: string;
      profileImageUrl?: string;
      isOnline?: boolean;
      lastSeen?: Date;
    };
  };
  onBack?: () => void;
}

export default function ChatWindow({ 
  chatId = 'default', 
  currentUserId = 'user1', 
  selectedChat,
  onBack 
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isDevPanelOpen, setIsDevPanelOpen] = useState(false);
  // Get the dynamic WebSocket URL based on current domain
  const getWebSocketUrl = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}:8080/ws`;
  };

  const { 
    isConnected, 
    sendMessage, 
    lastMessage,
    connectionStatus 
  } = useWebSocket(getWebSocketUrl());

  // ESC tugmasi bilan ortga qaytish
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onBack) {
        onBack();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onBack]);

  // Chat ma'lumotlarini olish
  const getChatDisplayName = () => {
    if (!selectedChat) return 'UltraSecure Chat';
    
    if (selectedChat.isGroup) {
      return selectedChat.name || 'Group Chat';
    }
    
    if (selectedChat.otherUser) {
      const { firstName, lastName, username } = selectedChat.otherUser;
      if (firstName && lastName) {
        return `${firstName} ${lastName}`;
      }
      return username || 'Unknown User';
    }
    
    return 'UltraSecure Chat';
  };

  const getChatAvatar = () => {
    if (!selectedChat || selectedChat.isGroup) return undefined;
    return selectedChat.otherUser?.profileImageUrl;
  };

  const getChatInitials = () => {
    if (!selectedChat) return 'UC';
    
    if (selectedChat.isGroup) {
      return selectedChat.name?.charAt(0).toUpperCase() || 'G';
    }
    
    if (selectedChat.otherUser) {
      const { firstName, lastName, username } = selectedChat.otherUser;
      if (firstName && lastName) {
        return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
      }
      if (firstName) {
        return firstName.charAt(0).toUpperCase();
      }
      if (username) {
        return username.charAt(0).toUpperCase();
      }
    }
    
    return 'U';
  };

  const getLastActivity = () => {
    if (!selectedChat || selectedChat.isGroup || !selectedChat.otherUser) return '';
    
    const { isOnline, lastSeen } = selectedChat.otherUser;
    
    if (isOnline) {
      return 'Hozir onlayn';
    }
    
    if (lastSeen) {
      const now = new Date();
      const lastSeenDate = new Date(lastSeen);
      const diffInMinutes = Math.floor((now.getTime() - lastSeenDate.getTime()) / (1000 * 60));
      
      if (diffInMinutes < 1) {
        return 'Hozirgina onlayn edi';
      } else if (diffInMinutes < 60) {
        return `${diffInMinutes} daqiqa oldin ko'rilgan`;
      } else if (diffInMinutes < 1440) { // 24 hours
        const hours = Math.floor(diffInMinutes / 60);
        return `${hours} soat oldin ko'rilgan`;
      } else {
        const days = Math.floor(diffInMinutes / 1440);
        return `${days} kun oldin ko'rilgan`;
      }
    }
    
    return 'Oxirgi faollik noma\'lum';
  };

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

    // Add to local messages immediately
    const localMessage: Message = {
      id: Date.now().toString(),
      content: content,
      userId: currentUserId || 'user1',
      timestamp: new Date(),
      encrypted: true
    };

    setMessages(prev => [...prev, localMessage]);

    // Send simple message via WebSocket
    if (sendMessage && typeof sendMessage === 'function') {
      sendMessage(content);
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0 pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onBack}
                className="p-1 h-8 w-8"
                data-testid="back-button"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={getChatAvatar() || undefined} />
                  <AvatarFallback>{getChatInitials()}</AvatarFallback>
                </Avatar>
                {selectedChat && !selectedChat.isGroup && selectedChat.otherUser?.isOnline && (
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
                )}
              </div>
              
              <div className="flex flex-col">
                <span className="font-medium text-sm" data-testid="chat-title">
                  {getChatDisplayName()}
                </span>
                {selectedChat && !selectedChat.isGroup && selectedChat.otherUser && (
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">
                      @{selectedChat.otherUser.username}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {getLastActivity()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <Shield className="h-4 w-4 text-green-500" />
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
            {/* Dev Panel Toggle Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsDevPanelOpen(true)}
              className="p-1 h-6 w-6 ml-2"
              title="Developer Tools"
              data-testid="dev-panel-button"
            >
              <Settings className="h-3 w-3" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-4 py-4">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isOwn={message.userId === currentUserId}
                senderName={message.userId === 'system' ? 'System' : `User ${message.userId}`}
                senderId={message.userId}
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

      {/* Dev Panel */}
      <DevPanel
        isOpen={isDevPanelOpen}
        onClose={() => setIsDevPanelOpen(false)}
        currentMessages={messages.map(msg => ({
          id: msg.id,
          content: msg.content,
          encrypted: msg.encrypted,
          originalContent: msg.content,
          encryptedContent: msg.encrypted ? `🔒 ENCRYPTED_${msg.id}_${btoa(msg.content).substring(0, 20)}...` : undefined
        }))}
        connectionStatus={connectionStatus}
        isConnected={isConnected}
      />
    </Card>
  );
}