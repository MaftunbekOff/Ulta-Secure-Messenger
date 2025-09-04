// The following code applies caching and optimization for message previews as requested.
import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Settings, Users, User, Hash, Plus, MessageCircle, Pin, Trash2, Link, UserCheck, UserX, CheckCheck, Volume2, VolumeX, Archive } from "lucide-react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger, ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu";
import { getAuthHeaders } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { decryptMessage, isMilitaryEncryptionAvailable } from "@/lib/militaryEncryption";
import type { Chat, User as UserType, Message } from "@shared/schema";
import { chatCache, preWarmCache } from "@/lib/superCache";

interface SidebarProps {
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  isMobile?: boolean;
}

type ChatWithExtras = Chat & {
  lastMessage?: Message & { sender: UserType };
  unreadCount: number;
  otherUser?: UserType;
};

export default function Sidebar({ selectedChatId, onSelectChat, isMobile = false }: SidebarProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "direct" | "group">("all");
  const [searchedUser, setSearchedUser] = useState<UserType | null>(null);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const [decryptedPreviews, setDecryptedPreviews] = useState<{[chatId: string]: string}>({});
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    targetUserId: string | null;
    targetUsername: string;
  }>({ isOpen: false, position: { x: 0, y: 0 }, targetUserId: null, targetUsername: "" });

  // Touch handling for mobile context menu
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Long press handlers for mobile
  const handleTouchStart = (e: React.TouchEvent, chatId: string, username: string) => {
    if (!isMobile) return;

    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };

    // Start long press timer
    longPressTimer.current = setTimeout(() => {
      // Haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }

      // Show context menu
      document.dispatchEvent(new Event('closeContextMenus'));
      setTimeout(() => {
        setContextMenu({
          isOpen: true,
          position: touchStart.current || { x: 0, y: 0 },
          targetUserId: chatId,
          targetUsername: username
        });
      }, 10);
    }, 500); // 500ms long press
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    touchStart.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart.current || !longPressTimer.current) return;

    const touch = e.touches[0];
    const distance = Math.sqrt(
      Math.pow(touch.clientX - touchStart.current.x, 2) +
      Math.pow(touch.clientY - touchStart.current.y, 2)
    );

    // Cancel long press if moved too much (more than 10px)
    if (distance > 10) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // Listen for global context menu close events
  useEffect(() => {
    const handleCloseContextMenus = () => {
      setContextMenu({ isOpen: false, position: { x: 0, y: 0 }, targetUserId: null, targetUsername: "" });
    };

    document.addEventListener('closeContextMenus', handleCloseContextMenus);
    return () => {
      document.removeEventListener('closeContextMenus', handleCloseContextMenus);
      // Cleanup timer on unmount
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  // Context menu actions for chat management
  const handleMarkAsRead = () => {
    toast({
      title: "Feature Coming Soon",
      description: "Mark as read functionality will be available soon.",
    });
  };

  const handlePinToTop = () => {
    toast({
      title: "Feature Coming Soon",
      description: "Pin to top functionality will be available soon.",
    });
  };

  const handleMuteChat = () => {
    toast({
      title: "Feature Coming Soon",
      description: "Mute chat functionality will be available soon.",
    });
  };

  const handleArchiveChat = () => {
    toast({
      title: "Feature Coming Soon",
      description: "Archive chat functionality will be available soon.",
    });
  };

  const handleDeleteChat = () => {
    toast({
      title: "Feature Coming Soon",
      description: "Delete chat functionality will be available soon.",
    });
  };

  // Search users function
  const searchUser = async (username: string) => {
    if (username.length < 2) {
      setSearchedUser(null);
      return;
    }

    try {
      const response = await fetch(`/api/users/search/${encodeURIComponent(username)}`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const userData = await response.json();
        setSearchedUser(userData);
      } else {
        setSearchedUser(null);
      }
    } catch (error) {
      setSearchedUser(null);
    }
  };

  // Create or find direct chat mutation
  const createDirectChatMutation = useMutation({
    mutationFn: async (otherUserId: string) => {
      const response = await fetch("/api/chats", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          participantId: otherUserId,
          isGroup: false 
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create chat");
      }

      return response.json();
    },
    onSuccess: (newChat) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      onSelectChat(newChat.id);
      setSearchTerm("");
      setSearchedUser(null);
    },
  });

  // Handle search input change with debouncing
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);

    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    const newTimeout = setTimeout(() => {
      searchUser(value);
    }, 300);

    setSearchTimeout(newTimeout);
  };

  const { data: chats = [], isLoading } = useQuery({
    queryKey: ["/api/chats"],
    queryFn: async (): Promise<ChatWithExtras[]> => {
      const response = await fetch("/api/chats", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    staleTime: 15000, // 15 seconds for chat list
    gcTime: 300000, // 5 minutes cache
  });

  // Decrypt message previews when chats change
  useEffect(() => {
    const decryptPreviews = async () => {
      const newPreviews: {[chatId: string]: string} = {};

      for (const chat of chats) {
        if (chat.lastMessage?.content) {
          try {
            const preview = await getMessagePreview(chat.lastMessage.content);
            newPreviews[chat.id] = preview;
          } catch (error) {
            // Secure error handling without sensitive logging
            newPreviews[chat.id] = "🔒 Protected message";
          }
        } else {
          newPreviews[chat.id] = "No messages yet";
        }
      }

      setDecryptedPreviews(newPreviews);
    };

    if (chats.length > 0) {
      decryptPreviews();
    }
  }, [chats, selectedChatId]);

  const filteredChats = chats.filter((chat) => {
    // Filter by search term
    const searchMatch = !searchTerm || 
      (chat.isGroup ? chat.name?.toLowerCase().includes(searchTerm.toLowerCase()) : 
       chat.otherUser?.username.toLowerCase().includes(searchTerm.toLowerCase()));

    // Filter by active filter
    const typeMatch = activeFilter === "all" || 
      (activeFilter === "direct" && !chat.isGroup) ||
      (activeFilter === "group" && chat.isGroup);

    return searchMatch && typeMatch;
  });

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: false,
      });
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return date.toLocaleDateString("en-US", { weekday: "long" });
    } else {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
  };

  // Helper function to format message preview with decryption
  const getMessagePreview = async (content: string | undefined): Promise<string> => {
    if (!content) return "No messages yet";

    try {
      // Send to server for secure decryption
      const response = await fetch('/api/messages/decrypt-preview', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content })
      });

      if (response.ok) {
        const result = await response.json();
        return result.preview;
      } else {
        // Fallback to client-side handling
        return handleClientSidePreview(content);
      }
    } catch (error) {
      // Secure fallback without logging sensitive data
      return handleClientSidePreview(content);
    }
  };

  // Fallback client-side preview handling with enhanced security
  const handleClientSidePreview = (content: string): string => {
    // Military-grade messages
    if (content.startsWith('{') && content.includes('encryptedContent')) {
      return "🔒 End-to-end encrypted";
    }

    // Legacy encrypted format
    if (content.startsWith('{')) {
      try {
        const parsed = JSON.parse(content);
        if (parsed.encrypted && parsed.iv && parsed.algorithm) {
          return "🔒 Encrypted message";
        }
      } catch (parseError) {
        // Treat as potentially encrypted, be safe
        return "🔒 Protected content";
      }
    }

    // Base64 or other encoded content
    if (content.length > 20 && (/^[A-Za-z0-9+/]+=*$/.test(content) || content.includes('='))) {
      return "🔒 Encrypted content";
    }

    // Regular plain text - sanitize to prevent XSS
    const sanitized = content.replace(/[<>&"']/g, '').trim();
    if (!sanitized) return "Empty message";

    return sanitized.length > 50 ? sanitized.substring(0, 47) + "..." : sanitized;
  };

  // Memoize expensive calculations
  const chatHelpers = useMemo(() => ({
    getChatDisplayName: (chat: ChatWithExtras) => {
      if (chat.isGroup) {
        return chat.name || "Group Chat";
      }
      return chat.otherUser?.firstName && chat.otherUser?.lastName 
        ? `${chat.otherUser.firstName} ${chat.otherUser.lastName}`
        : chat.otherUser?.username || "Unknown User";
    },

    getChatAvatar: (chat: ChatWithExtras) => {
      if (chat.isGroup) {
        return null;
      }
      return chat.otherUser?.profileImageUrl;
    },

    getChatInitials: (chat: ChatWithExtras) => {
      if (chat.isGroup) {
        return chat.name?.charAt(0).toUpperCase() || "G";
      }
      const avatarText = chat.otherUser?.username?.charAt(0).toUpperCase() || "?";
      return avatarText;
    }
  }), [user?.id]);

  // Search functionality with proper cleanup
  useEffect(() => {
    if (searchTerm.length < 2) {
      setSearchedUser(null);
      return;
    }

    const searchUsers = async () => {
      try {
        const response = await fetch(`/api/users/search/${encodeURIComponent(searchTerm)}`, {
          headers: getAuthHeaders(),
        });

        if (response.ok) {
          const userData = await response.json();
          setSearchedUser(userData);
        } else {
          setSearchedUser(null);
        }
      } catch (error) {
        console.error("Search error:", error);
        setSearchedUser(null);
      }
    };

    const debounceTimer = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm]);

  if (isLoading) {
    return (
      <div className="w-80 bg-card border-r border-border flex items-center justify-center">
        <div className="text-muted-foreground">Loading chats...</div>
      </div>
    );
  }

  return (
    <div className={`${isMobile ? 'w-full mobile-sidebar' : 'w-80 flex flex-col'} bg-card border-r border-border`}>
      {/* Header */}
      <div className={`flex items-center justify-between p-4 border-b border-border ${isMobile ? 'mobile-sidebar-header' : ''}`}>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="flex items-center space-x-3 cursor-pointer" data-testid="user-profile-trigger">
              <Avatar className="h-10 w-10">
                <AvatarImage src={user?.profileImageUrl || undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                  {user?.username?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h3 className="font-medium text-sm truncate" data-testid="user-name">
                  {user?.firstName && user?.lastName 
                    ? `${user.firstName} ${user.lastName}`
                    : user?.username
                  }
                </h3>
                <p className="text-xs text-muted-foreground truncate" data-testid="user-handle">
                  @{user?.username}
                </p>
              </div>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-56" data-testid="user-context-menu">
            <ContextMenuItem onClick={() => setLocation("/profile")} data-testid="context-menu-profile">
              <Settings className="mr-2 h-4 w-4" />
              Profile Settings
            </ContextMenuItem>
            <ContextMenuItem onClick={() => {
              if (user) {
                const profileUrl = `${window.location.origin}/profile/${user.id}`;
                navigator.clipboard.writeText(profileUrl);
                toast({
                  title: "Success",
                  description: "Profile link copied to clipboard!",
                });
              }
            }} data-testid="context-menu-copy-link">
              <Link className="mr-2 h-4 w-4" />
              Copy Profile Link
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => {
              toast({
                title: "Feature Coming Soon",
                description: "Clear all chats functionality will be available soon.",
              });
            }} data-testid="context-menu-clear-chats">
              <Trash2 className="mr-2 h-4 w-4" />
              Clear All Chats
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => {
              localStorage.removeItem('auth_token');
              queryClient.clear();
              window.location.reload();
            }} className="text-destructive focus:text-destructive" data-testid="context-menu-logout">
              <UserX className="mr-2 h-4 w-4" />
              Logout
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        <Button
          variant="ghost"
          size="sm"
          className="p-2 h-auto"
          onClick={() => setLocation("/profile")}
          data-testid="button-settings"
        >
          <Settings className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>

      {/* Search */}
      <div className={`p-4 ${isMobile ? 'mobile-sidebar-header' : ''}`}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search chats or users..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
      </div>

      {/* Filters */}
      <div className={`px-4 pb-4 ${isMobile ? 'mobile-sidebar-header' : ''}`}>
        <div className="flex space-x-2">
          <Button
            variant={activeFilter === "all" ? "default" : "secondary"}
            size="sm"
            onClick={() => setActiveFilter("all")}
            className="text-xs"
            data-testid="button-filter-all"
          >
            All
          </Button>
          <Button
            variant={activeFilter === "direct" ? "default" : "secondary"}
            size="sm"
            onClick={() => setActiveFilter("direct")}
            className="text-xs"
            data-testid="button-filter-direct"
          >
            <User className="h-3 w-3 mr-1" />
            Direct
          </Button>
          <Button
            variant={activeFilter === "group" ? "default" : "secondary"}
            size="sm"
            onClick={() => setActiveFilter("group")}
            className="text-xs"
            data-testid="button-filter-group"
          >
            <Hash className="h-3 w-3 mr-1" />
            Groups
          </Button>
        </div>
      </div>

      {/* Chat List */}
      <div className={`${isMobile ? 'mobile-sidebar-content' : 'flex-1 overflow-y-auto'}`}>
        <div className={`${isMobile ? 'mobile-chat-scroll' : ''}`}>
        {/* Show searched user if any */}
        {searchTerm && searchedUser && (
          <>
            <div className="px-4 py-2 text-xs text-muted-foreground uppercase font-medium border-b border-border">
              New Chat
            </div>
            <div
              className="p-4 border-b border-border hover:bg-accent cursor-pointer transition-colors"
              onClick={() => createDirectChatMutation.mutate(searchedUser.id)}
              data-testid={`new-chat-${searchedUser.id}`}
            >
              <div className="flex items-center space-x-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={searchedUser.profileImageUrl || undefined} />
                  <AvatarFallback className="bg-secondary text-secondary-foreground font-semibold">
                    {searchedUser.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-sm truncate" data-testid={`user-name-${searchedUser.id}`}>
                      {searchedUser.firstName && searchedUser.lastName 
                        ? `${searchedUser.firstName} ${searchedUser.lastName}`
                        : searchedUser.username
                      }
                    </h4>
                    {searchedUser.isOnline && (
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    @{searchedUser.username}
                  </p>
                </div>
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            {filteredChats.length > 0 && (
              <div className="px-4 py-2 text-xs text-muted-foreground uppercase font-medium border-b border-border">
                Your Chats
              </div>
            )}
          </>
        )}

        {filteredChats.length === 0 && !searchedUser ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            {searchTerm ? "No chats or users found" : "No chats yet"}
          </div>
        ) : (
          filteredChats.map((chat) => {
            // Directly use the chat object to access its lastMessage
            const lastMessage = chat.lastMessage;

            // Get preview from the cached state
            const messagePreview = lastMessage?.content ? 
              (decryptedPreviews[chat.id] || "Loading...") : 
              "No messages yet";

            return (
              <div
                key={chat.id}
                className={`p-4 border-b border-border hover:bg-accent cursor-pointer transition-colors ${
                  selectedChatId === chat.id ? "bg-accent" : ""
                }`}
                onClick={() => onSelectChat(chat.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setContextMenu({
                    isOpen: true,
                    position: { x: e.clientX, y: e.clientY },
                    targetUserId: chat.otherUser?.id || null,
                    targetUsername: chat.otherUser?.username || chatHelpers.getChatDisplayName(chat),
                  });
                }}
                onTouchStart={(e) => handleTouchStart(e, chat.id, chatHelpers.getChatDisplayName(chat))}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchMove}
                data-testid={`chat-item-${chat.id}`}
              >
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={chatHelpers.getChatAvatar(chat) || undefined} />
                      <AvatarFallback>{chatHelpers.getChatInitials(chat)}</AvatarFallback>
                    </Avatar>
                    {!chat.isGroup && chat.otherUser?.isOnline && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-background rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium text-sm truncate" data-testid={`chat-name-${chat.id}`}>
                        {chatHelpers.getChatDisplayName(chat)}
                      </h4>
                      {chat.lastMessage && (
                        <span className="text-xs text-muted-foreground" data-testid={`chat-time-${chat.id}`}>
                          {formatTime(chat.lastMessage.createdAt!.toString())}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate" data-testid={`chat-preview-${chat.id}`}>
                      {messagePreview}
                    </p>
                  </div>
                  {chat.unreadCount > 0 && (
                    <Badge
                      variant="default"
                      className="bg-primary text-primary-foreground text-xs min-w-5 h-5 flex items-center justify-center"
                      data-testid={`chat-unread-${chat.id}`}
                    >
                      {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
                    </Badge>
                  )}
                </div>
              </div>
            );
          })
        )}
        </div>
      </div>

      {/* Custom Context Menu */}
      {contextMenu.isOpen && (
        <div 
          className="fixed inset-0 z-50" 
          onClick={() => {
            setContextMenu({ ...contextMenu, isOpen: false });
          }}
          onContextMenu={(e) => {
            const chatItem = (e.target as HTMLElement).closest('[data-testid^="chat-item-"]');
            if (chatItem) {
              return;
            } else {
              e.preventDefault();
              setContextMenu({ ...contextMenu, isOpen: false });
            }
          }}
        >
          <div 
            className={`absolute bg-popover border border-border ${isMobile ? 'rounded-xl shadow-2xl py-2 min-w-60' : 'rounded-md shadow-lg py-1 min-w-48'}`}
            style={{ 
              left: isMobile ? Math.max(8, Math.min(contextMenu.position.x, window.innerWidth - 250)) : Math.min(contextMenu.position.x, window.innerWidth - 200), 
              top: isMobile ? Math.max(8, Math.min(contextMenu.position.y, window.innerHeight - 350)) : Math.min(contextMenu.position.y, window.innerHeight - 300),
              transform: contextMenu.position.x > window.innerWidth - 200 ? 'translate(-100%, 0)' : 'translate(0, 0)',
              zIndex: 10000
            }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation(); 
            }}
          >
            <div className="px-3 py-2 text-sm font-medium text-muted-foreground border-b border-border">
              {contextMenu.targetUsername}
            </div>
            <button
              className={`flex items-center w-full ${isMobile ? 'px-4 py-3 text-base' : 'px-3 py-2 text-sm'} hover:bg-accent transition-colors touch-manipulation`}
              onClick={() => {
                handleMarkAsRead();
                setContextMenu({ ...contextMenu, isOpen: false });
              }}
            >
              <CheckCheck className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'} mr-2`} />
              Mark as Read
            </button>
            <button
              className={`flex items-center w-full ${isMobile ? 'px-4 py-3 text-base' : 'px-3 py-2 text-sm'} hover:bg-accent transition-colors touch-manipulation`}
              onClick={() => {
                handlePinToTop();
                setContextMenu({ ...contextMenu, isOpen: false });
              }}
            >
              <Pin className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'} mr-2`} />
              Pin to Top
            </button>
            <button
              className={`flex items-center w-full ${isMobile ? 'px-4 py-3 text-base' : 'px-3 py-2 text-sm'} hover:bg-accent transition-colors touch-manipulation`}
              onClick={() => {
                handleMuteChat();
                setContextMenu({ ...contextMenu, isOpen: false });
              }}
            >
              <VolumeX className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'} mr-2`} />
              Mute
            </button>
            <button
              className={`flex items-center w-full ${isMobile ? 'px-4 py-3 text-base' : 'px-3 py-2 text-sm'} hover:bg-accent transition-colors touch-manipulation`}
              onClick={() => {
                handleArchiveChat();
                setContextMenu({ ...contextMenu, isOpen: false });
              }}
            >
              <Archive className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'} mr-2`} />
              Archive
            </button>
            <div className="border-t border-border my-1"></div>
            <button
              className={`flex items-center w-full ${isMobile ? 'px-4 py-3 text-base' : 'px-3 py-2 text-sm'} text-destructive hover:bg-accent transition-colors touch-manipulation`}
              onClick={() => {
                handleDeleteChat();
                setContextMenu({ ...contextMenu, isOpen: false });
              }}
            >
              <Trash2 className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'} mr-2`} />
              Delete Chat
            </button>
          </div>
        </div>
      )}
    </div>
  );
}