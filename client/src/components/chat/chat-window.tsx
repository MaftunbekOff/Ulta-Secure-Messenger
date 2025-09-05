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
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';

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
  } = useWebSocket();

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

  // Handle incoming messages via WebSocket
  useEffect(() => {
    if (lastMessage) {
      try {
        const messageData = typeof lastMessage === 'string' 
          ? JSON.parse(lastMessage) 
          : lastMessage;

        if (messageData.type === 'message' && messageData.chatId === chatId) {
          // Refresh message history from database instead of adding locally
          // This ensures consistency and avoids duplicates
          queryClient.invalidateQueries({ queryKey: ['/api/chats', chatId, 'messages'] });
        }
      } catch (error) {
        console.warn('Failed to parse message:', error);
      }
    }
  }, [lastMessage, chatId]);

  // Load message history from database
  const { data: messageHistory, isLoading: isLoadingMessages } = useQuery({
    queryKey: ['/api/chats', chatId, 'messages'],
    enabled: !!chatId && chatId !== 'default',
  });

  // Initialize messages from database when loaded
  useEffect(() => {
    if (messageHistory && Array.isArray(messageHistory)) {
      const formattedMessages: Message[] = messageHistory.map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        userId: msg.senderId || msg.userId,
        timestamp: new Date(msg.createdAt),
        encrypted: msg.isEncrypted
      }));
      setMessages(formattedMessages);
    } else if (!isLoadingMessages) {
      // Only clear messages if not loading and no data
      setMessages([]);
    }
  }, [messageHistory, isLoadingMessages]);

  const handleSendMessage = async (content: string) => {
    if (!chatId || chatId === 'default') {
      console.warn('No valid chat selected');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('No authentication token found, using WebSocket only');
        // Fallback to WebSocket only
        if (isConnected && sendMessage && typeof sendMessage === 'function') {
          sendMessage(content);
        }
        return;
      }

      // Send message via API (saves to database)
      const response = await fetch(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content: content,
          messageType: 'text'
        })
      });

      if (response.ok) {
        const newMessage = await response.json();
        console.log('✅ Message saved to database:', newMessage.id);
        
        // Invalidate cache to refresh message list
        queryClient.invalidateQueries({ queryKey: ['/api/chats', chatId, 'messages'] });
        
        // Also send via WebSocket for real-time delivery to other clients
        if (isConnected && sendMessage && typeof sendMessage === 'function') {
          sendMessage(content);
        }
      } else if (response.status === 401) {
        console.warn('Authentication failed - token expired or invalid');
        console.log('🚨 Please log in again to save messages to database');
        
        // Fallback to WebSocket only for now
        if (isConnected && sendMessage && typeof sendMessage === 'function') {
          sendMessage(content);
        }
      } else {
        console.error(`Failed to send message via API: ${response.status}`);
        
        // Fallback to WebSocket only if API fails
        if (isConnected && sendMessage && typeof sendMessage === 'function') {
          sendMessage(content);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Fallback to WebSocket only
      if (isConnected && sendMessage && typeof sendMessage === 'function') {
        sendMessage(content);
      }
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
            {isLoadingMessages ? (
              <div className="flex justify-center items-center h-32">
                <div className="text-muted-foreground">Loading messages...</div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <div className="text-muted-foreground mb-2">No messages yet</div>
                <div className="text-sm text-muted-foreground">Start a secure conversation</div>
              </div>
            ) : (
              messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={{
                    ...message,
                    senderId: message.userId,
                    timestamp: typeof message.timestamp === 'number' ? message.timestamp : message.timestamp.getTime()
                  }}
                  isOwn={message.userId === currentUserId}
                  senderName={message.userId === 'system' ? 'System' : `User ${message.userId}`}
                  senderId={message.userId}
                />
              ))
            )}
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
          encryptedContent: msg.encrypted ? `🔒 ENCRYPTED_${msg.id}_${encodeURIComponent(msg.content).substring(0, 20)}...` : undefined
        }))}
        connectionStatus={connectionStatus}
        isConnected={isConnected}
      />
    </Card>
  );
}