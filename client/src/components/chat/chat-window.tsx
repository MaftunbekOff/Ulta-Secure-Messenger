import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Video, Phone, Info, Users, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import MessageBubble from "./message-bubble";
import MessageInput from "./message-input";
import { getAuthHeaders } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { encryptMessage, isMilitaryEncryptionAvailable } from "@/lib/militaryEncryption";
import type { Chat, Message, User } from "@shared/schema";
import { encryptionManager } from "@/lib/encryptionIntegration";

interface ChatWindowProps {
  chatId: string;
  isMobile?: boolean;
}

type MessageWithSender = Message & { sender: User };
type ChatWithExtras = Chat & {
  lastMessage?: Message & { sender: User };
  unreadCount: number;
  otherUser?: User;
  members?: Array<{ user: User }>;
};

export default function ChatWindow({ chatId, isMobile = false }: ChatWindowProps) {
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { lastMessage, joinChat, sendTyping, isConnected } = useWebSocket();

  // Fetch chat details
  const { data: chat } = useQuery({
    queryKey: ["/api/chats", chatId],
    enabled: !!user,
    queryFn: async (): Promise<ChatWithExtras> => {
      const response = await fetch(`/api/chats/${chatId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
  });

  // State for pagination
  const [allMessages, setAllMessages] = useState<MessageWithSender[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);

  // Get chat messages with aggressive caching
  const { data: initialMessages = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/chats", chatId, "messages"],
    queryFn: async (): Promise<MessageWithSender[]> => {
      const response = await fetch(`/api/chats/${chatId}/messages?limit=50&offset=0`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!chatId,
    staleTime: 300000, // 5 minutes - much longer cache
    gcTime: 1800000, // 30 minutes garbage collection
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: false, // Don't refetch on component mount if data exists
    retry: 1, // Reduce retry attempts
  });

  // Update all messages when initial messages change
  useEffect(() => {
    if (initialMessages.length > 0) {
      setAllMessages(initialMessages);
      setHasMoreMessages(initialMessages.length === 50); // If we got full batch, there might be more
    }
  }, [initialMessages]);

  // Function to load more messages
  const loadMoreMessages = async () => {
    if (isLoadingMore || !hasMoreMessages) return;

    setIsLoadingMore(true);
    try {
      const response = await fetch(`/api/chats/${chatId}/messages?limit=50&offset=${allMessages.length}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      const olderMessages: MessageWithSender[] = await response.json();

      if (olderMessages.length === 0) {
        setHasMoreMessages(false);
      } else {
        // Prepend older messages to the beginning of the array
        setAllMessages(prev => [...olderMessages, ...prev]);
        setHasMoreMessages(olderMessages.length === 50);
      }
    } catch (error) {
      console.error('Failed to load more messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Send message mutation with military-grade encryption
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      let encryptedContent = content;

      // Apply military-grade end-to-end encryption if available
      if (isMilitaryEncryptionAvailable() && chat?.otherUser?.publicKey) {
        try {
          encryptedContent = await encryptMessage(content, chat.otherUser.publicKey);
        } catch (error) {
          console.error('Military encryption failed, sending without encryption:', error);
          // Fallback to unencrypted if encryption fails
        }
      }

      const response = await apiRequest("POST", `/api/chats/${chatId}/messages`, {
        content: encryptedContent,
        messageType: "text",
      });
      return response.json();
    },
    onSuccess: (newMessage) => {
      // Optimistic update - add new message to cache immediately
      queryClient.setQueryData(["/api/chats", chatId, "messages"], (oldMessages: any) => {
        return oldMessages ? [...oldMessages, newMessage] : [newMessage];
      });
      // Only invalidate chat list to update last message preview
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'message':
        if (lastMessage.chatId === chatId && lastMessage.senderId !== user?.id) {
          // Refresh messages to show new message
          queryClient.invalidateQueries({ queryKey: ["/api/chats", chatId, "messages"] });
          queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
        }
        break;

      case 'typing':
        if (lastMessage.chatId === chatId && lastMessage.senderId !== user?.id) {
          setTypingUsers(prev => new Set(prev).add(lastMessage.senderId!));

          // Clear typing indicator after 3 seconds
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }
          typingTimeoutRef.current = setTimeout(() => {
            setTypingUsers(prev => {
              const newSet = new Set(prev);
              newSet.delete(lastMessage.senderId!);
              return newSet;
            });
          }, 3000);
        }
        break;
    }
  }, [lastMessage, chatId, user?.id, queryClient]);

  // Join chat room on mount
  useEffect(() => {
    if (isConnected) {
      joinChat(chatId);
    }
  }, [chatId, isConnected, joinChat]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages]); // Depend on allMessages to trigger scroll when new messages are added

  const handleSendMessage = (content: string) => {
    sendMessageMutation.mutate(content);
  };

  const handleTyping = () => {
    if (isConnected) {
      sendTyping(chatId);
    }
  };

  const getChatDisplayName = () => {
    if (!chat) return "";
    if (chat.isGroup) {
      return chat.name || "Group Chat";
    }
    return chat.otherUser?.firstName && chat.otherUser?.lastName
      ? `${chat.otherUser.firstName} ${chat.otherUser.lastName}`
      : chat.otherUser?.username || "Unknown User";
  };

  const getChatAvatar = () => {
    if (!chat) return null;
    if (chat.isGroup) {
      return <Users className="h-6 w-6" />;
    }
    const avatarText = chat.otherUser?.username?.charAt(0).toUpperCase() || "?";
    return (
      <Avatar className="h-10 w-10">
        <AvatarImage src={chat.otherUser?.profileImageUrl || undefined} />
        <AvatarFallback className="bg-secondary text-secondary-foreground font-semibold">
          {avatarText}
        </AvatarFallback>
      </Avatar>
    );
  };

  const getOnlineStatus = () => {
    if (!chat || chat.isGroup) return null;
    return chat.otherUser?.isOnline ? (
      <div className="flex items-center space-x-1">
        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
        <span className="text-xs text-muted-foreground">Online</span>
      </div>
    ) : (
      <span className="text-xs text-muted-foreground">
        {chat.otherUser?.lastSeen
          ? `Last seen ${new Date(chat.otherUser.lastSeen).toLocaleDateString()}`
          : "Offline"
        }
      </span>
    );
  };

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-muted-foreground">Please log in to access chat.</div>
      </div>
    );
  }

  if (isLoading && allMessages.length === 0) { // Show loading only if no messages are loaded yet
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-muted-foreground">Loading messages...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Chat Header */}
      <div className={`flex items-center justify-between ${isMobile ? 'p-3' : 'p-4'} border-b border-border bg-card`}>
        <div className="flex items-center space-x-3">
          {getChatAvatar()}
          <div>
            <h3 className="font-medium text-sm" data-testid="chat-title">
              {getChatDisplayName()}
            </h3>
            {getOnlineStatus()}
          </div>
        </div>
        <div className={`flex items-center ${isMobile ? 'space-x-1' : 'space-x-2'}`}>
          <Button
            variant="ghost"
            size="sm"
            className="p-2 h-auto"
            data-testid="button-video-call"
          >
            <Video className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'} text-muted-foreground`} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="p-2 h-auto"
            data-testid="button-voice-call"
          >
            <Phone className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'} text-muted-foreground`} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="p-2 h-auto"
            data-testid="button-chat-info"
          >
            <Info className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'} text-muted-foreground`} />
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <div
        className={`${isMobile ? 'messages-container p-4 space-y-4' : 'flex-1 p-4 space-y-4 custom-scrollbar'}`}
        style={isMobile ? {
          height: 'calc(100vh - 140px)',
          maxHeight: 'calc(100vh - 140px)',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          position: 'relative',
          zIndex: 1
        } : {
          height: 'calc(100vh - 120px)',
          maxHeight: 'calc(100vh - 120px)',
          overflowY: 'auto',
          position: 'relative'
        }}
        onScroll={(e) => {
          const target = e.target as HTMLDivElement;
          // Load more when scrolled near the top (20px from top)
          if (target.scrollTop < 20 && hasMoreMessages && !isLoadingMore) {
            const scrollHeight = target.scrollHeight;
            loadMoreMessages().then(() => {
              // Maintain scroll position after loading more messages
              requestAnimationFrame(() => {
                target.scrollTop = target.scrollHeight - scrollHeight;
              });
            });
          }
        }}
      >
        {isLoadingMore && (
          <div className="text-center py-2 text-muted-foreground text-sm">
            Loading older messages...
          </div>
        )}
        {allMessages.map((message, index) => {
            const isOwn = message.senderId === user?.id;

            return (
              <MessageBubble
                key={`${message.id}-${index}-${message.timestamp}`}
                message={message}
                isOwn={isOwn}
                isMobile={isMobile}
              />
            );
          })}

        {/* Typing Indicators */}
        {typingUsers.size > 0 && (
          <div className="flex items-start">
            <div className="bg-card border border-border rounded-lg p-3">
              <div className="flex items-center space-x-1">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-xs text-muted-foreground ml-2">typing...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <MessageInput
        onSendMessage={handleSendMessage}
        onTyping={handleTyping}
        disabled={sendMessageMutation.isPending}
        isMobile={isMobile}
      />
    </div>
  );
}