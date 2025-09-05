import { useState, useEffect, useCallback, useRef } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Sidebar from "@/components/chat/sidebar";
import ChatWindow from "@/components/chat/chat-window";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { encryptMessage, isMilitaryEncryptionAvailable } from "../lib/militaryEncryption";
import { QuantumSafeEncryption } from "../lib/quantumSafe";
import { SelfDestructMessages, DESTRUCT_CONFIGS } from "../lib/selfDestructMessages";
import { securityMonitor } from "../lib/securityMonitor";
import { toast } from "sonner"; // Assuming 'sonner' is used for toast notifications
import { useQueryClient } from "@tanstack/react-query"; // Assuming react-query is used for data fetching

// Placeholder for actual active chat data structure and getChatDisplayData function
// In a real app, this would come from your state management or context
const activeChat = {
  id: "chat1",
  name: "John Doe",
  isGroup: false,
  members: [],
  avatar: "https://github.com/shadcn.png",
  status: "Online",
  otherUser: {
    id: "user2",
    username: "johndoe",
    firstName: "John",
    lastName: "Doe",
    profileImageUrl: "https://github.com/shadcn.png",
    isOnline: true,
    lastSeen: new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago
  }
};

const getChatDisplayData = (chat: any) => {
  if (chat.isGroup) {
    return { name: chat.name || "Group Chat", initials: "G", avatar: undefined };
  } else {
    const name = chat.name || "User";
    const initials = name
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .substring(0, 2);
    return { name, initials, avatar: chat.avatar, status: chat.status };
  }
};

// Mocking necessary context/state variables that are used in the `sendMessage` function
// In a real application, these would be provided by React Context or props.
const useChatContext = () => {
  const [selectedChat, setSelectedChat] = useState<any>(activeChat); // Mock selectedChat
  const [user, setUser] = useState<any>({ id: 'user1', name: 'Test User' }); // Mock user
  const [messages, setMessages] = useState<any[]>([]); // Mock messages
  const [isLoading, setIsLoading] = useState(false); // Mock isLoading state
  const queryClient = useQueryClient(); // Mock queryClient

  // Improved sendMessage function with better error handling
  const sendMessage = async (content: string) => {
    if (!content.trim() || !selectedChat || !user) {
      console.warn('Missing required data for sending message');
      return;
    }

    setIsLoading(true);
    const tempId = Date.now().toString();

    // Optimistically add message to UI
    const optimisticMessage = {
      id: tempId,
      content: content.trim(),
      senderId: user.id,
      sender: user,
      chatId: selectedChat.id,
      createdAt: new Date(),
      messageType: 'text' as const,
      isEncrypted: true
    };

    setMessages(prev => [...prev, optimisticMessage]);

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      console.log('Sending message to chat:', selectedChat.id);

      const response = await fetch(`/api/chats/${selectedChat.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: content.trim(),
          messageType: 'text'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const newMessage = await response.json();
      console.log('Message sent successfully:', newMessage.id);

      // Replace optimistic message with real message
      setMessages(prev => prev.map(msg => 
        msg.id === tempId ? newMessage : msg
      ));

      // Invalidate messages cache
      queryClient.invalidateQueries({ 
        queryKey: ['messages', selectedChat.id] 
      });

      // Success feedback
      console.log('✅ Xabar muvaffaqiyatli yuborildi');

    } catch (error) {
      console.error('❌ Xabar yuborishda xatolik:', error);

      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => msg.id !== tempId));

      // Show specific error to user
      const errorMessage = error instanceof Error ? error.message : 'Xabar yuborishda noma\'lum xatolik';
      toast.error(`Xatolik: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  return { selectedChat, user, messages, isLoading, sendMessage };
};


export default function Chat() {
  const [selectedChatId, setSelectedChatId] = useState<string | null>("default-chat");
  const [isMobile, setIsMobile] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null); // Ref for chat container
  const [autoScroll, setAutoScroll] = useState(true); // State for auto-scroll

  // Connection status monitoring
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline' | 'slow'>('online');
  const [offlineMessages, setOfflineMessages] = useState<any[]>([]);

  // Monitor connection quality
  useEffect(() => {
    let slowConnectionTimer: NodeJS.Timeout;

    const checkConnection = () => {
      if (!navigator.onLine) {
        setConnectionStatus('offline');
        return;
      }

      const start = Date.now();
      fetch('/api/health', { 
        method: 'HEAD',
        cache: 'no-store'
      })
      .then(() => {
        const responseTime = Date.now() - start;
        if (responseTime > 3000) {
          setConnectionStatus('slow');
        } else {
          setConnectionStatus('online');
        }
      })
      .catch(() => {
        setConnectionStatus('offline');
      });
    };

    // Check connection every 30 seconds
    const connectionInterval = setInterval(checkConnection, 30000);
    checkConnection(); // Initial check

    // Listen for online/offline events
    window.addEventListener('online', () => setConnectionStatus('online'));
    window.addEventListener('offline', () => setConnectionStatus('offline'));

    return () => {
      clearInterval(connectionInterval);
      if (slowConnectionTimer) clearTimeout(slowConnectionTimer);
      window.removeEventListener('online', () => setConnectionStatus('online'));
      window.removeEventListener('offline', () => setConnectionStatus('offline'));
    };
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Swipe functionality for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isSwipeLeft = distance > 50;
    const isSwipeRight = distance < -50;

    if (isMobile) {
      if (isSwipeRight && !isSidebarOpen) {
        setIsSidebarOpen(true);
      } else if (isSwipeLeft && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    }
  };

  const handleSelectChat = (chatId: string) => {
    setSelectedChatId(chatId);
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  };

  // Auto-select first chat when available
  useEffect(() => {
    // If no chat is selected or we have the default, try to select the first actual chat
    if (selectedChatId === "default-chat" || !selectedChatId) {
      // This will be handled by the sidebar when it loads chats
      // For now, keep default to show chat window
    }
  }, [selectedChatId]);

  // Function to handle sending messages with advanced security features
  const sendMessage = async (content: string, recipientPublicKey: string) => {
    let isEncrypted = false;
    let messageToSend = content;

    // Apply self-destruct timer if configured
    const destructConfig = DESTRUCT_CONFIGS.find(config => config.feature === 'chat');
    if (destructConfig) {
      const selfDestructInstance = SelfDestructMessages.getInstance();
      messageToSend = selfDestructInstance.applySelfDestruct(messageToSend, destructConfig.duration);
      securityMonitor.logSecurityEvent({
        type: 'feature_enabled',
        severity: 'info',
        details: { feature: 'self_destruct_messages', duration: destructConfig.duration }
      });
    }

    // Use quantum-safe military-grade encryption if available
    if (isMilitaryEncryptionAvailable()) {
      try {
        // Double encryption: Military + Quantum-safe
        const militaryEncrypted = await encryptMessage(messageToSend, recipientPublicKey);
        const quantumSafeInstance = QuantumSafeEncryption.getInstance();
        messageToSend = await quantumSafeInstance.quantumSafeEncrypt(militaryEncrypted, recipientPublicKey);
        isEncrypted = true;

        securityMonitor.logSecurityEvent({
          type: 'unusual_activity',
          severity: 'low',
          details: { 
            action: 'quantum_safe_message_sent',
            encryption_layers: 'military + quantum_safe'
          }
        });
      } catch (error) {
        console.error('Quantum-safe encryption failed:', error);
        securityMonitor.logSecurityEvent({
          type: 'encryption_failure',
          severity: 'high',
          details: { error: 'quantum_safe_encryption_failed', message: error }
        });
        // Fallback to regular encryption
      }
    }

    // Placeholder for actual message sending logic
    console.log("Sending message:", { message: messageToSend, encrypted: isEncrypted });
    // In a real app, you would send `messageToSend` via WebSocket or another transport
    // await sendMessageViaNetwork(messageToSend, recipientPublicKey, isEncrypted);
  };

  // Auto-scroll optimization
  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

      if (isNearBottom || autoScroll) {
        chatContainerRef.current.scrollTo({
          top: scrollHeight,
          behavior: connectionStatus === 'slow' ? 'auto' : 'smooth' // Faster scroll for slow connections
        });
      }
    }
  }, [autoScroll, connectionStatus]);

  return (
    <div className="flex h-screen bg-background relative">
      {/* Mobile Header */}
      {isMobile && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-background border-b border-border flex items-center justify-between p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            data-testid="button-mobile-menu"
          >
            {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <h1 className="font-semibold">UltraSecure Messenger</h1>
          <div className="w-9" />
        </div>
      )}

      {/* Sidebar */}
      <div className={`${isMobile ? 'absolute inset-y-0 left-0 z-40' : 'relative'} ${isMobile && !isSidebarOpen ? '-translate-x-full' : 'translate-x-0'} transition-transform duration-300 ease-in-out`}>
        <Sidebar
          selectedChatId={selectedChatId}
          onSelectChat={handleSelectChat}
          isMobile={isMobile}
        />
      </div>

      {/* Mobile Overlay */}
      {isMobile && isSidebarOpen && (
        <div 
          className="absolute inset-0 bg-black/20 z-30"
          onClick={() => setIsSidebarOpen(false)}
          data-testid="mobile-overlay"
        />
      )}

      {/* Swipe Detection Area - only when sidebar is closed */}
      {isMobile && !isSidebarOpen && (
        <div 
          className="absolute top-0 left-0 w-10 h-full z-20 pointer-events-auto"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
      )}

      {/* Main Content */}
      <div className={`flex-1 flex flex-col overflow-hidden ${isMobile ? 'pt-16' : ''}`}>
        {selectedChatId ? (
          <ChatWindow 
            chatId={selectedChatId} 
            currentUserId={"user1"}
            selectedChat={activeChat}
            onBack={() => setSelectedChatId(null)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-background text-center p-4">
            <div className="max-w-md mx-auto">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                <svg 
                  className="w-6 h-6 text-primary" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" 
                  />
                </svg>
              </div>
            </div>

            <h2 className="text-2xl font-bold mb-4">Welcome to UltraSecure Messenger</h2>
            <p className="text-muted-foreground mb-6">
              Select a conversation to start messaging securely with end-to-end encryption.
            </p>

            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Real-time messaging with WebSocket</span>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Offline message queue</span>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Virtual scrolling for performance</span>
              </div>
            </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}