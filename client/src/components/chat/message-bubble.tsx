import { useState, useEffect, useRef } from "react";
import { Lock, CheckCheck, Shield, Reply, Edit, Copy, Pin, Forward, MousePointer, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { decryptMessage, isMilitaryEncryptionAvailable } from "@/lib/militaryEncryption";
import type { Message, User } from "@shared/schema";

interface MessageBubbleProps {
  message: Message & { sender: User };
  isOwn: boolean;
  isMobile?: boolean;
}

export default function MessageBubble({ message, isOwn, isMobile = false }: MessageBubbleProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [decryptedContent, setDecryptedContent] = useState<string>(message.content);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [isMilitaryEncrypted, setIsMilitaryEncrypted] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
  }>({ isOpen: false, position: { x: 0, y: 0 } });
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);


  // Attempt to decrypt military-grade encrypted messages (with caching)
  useEffect(() => {
    const attemptDecryption = async () => {
      // Check if this looks like a military-encrypted message (JSON format)
      if (message.content.startsWith('{') && message.content.includes('encryptedContent')) {
        setIsMilitaryEncrypted(true);
        
        // Check cache first to avoid re-decryption
        const cacheKey = `decrypted_${message.id}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          setDecryptedContent(cached);
          return;
        }
        
        if (isMilitaryEncryptionAvailable()) {
          setIsDecrypting(true);
          try {
            const decrypted = await decryptMessage(message.content);
            setDecryptedContent(decrypted);
            // Cache decrypted content to avoid re-decryption
            sessionStorage.setItem(cacheKey, decrypted);
          } catch (error) {
            console.warn('Military decryption failed, trying fallback:', error);
            // Try basic fallback decryption
            try {
              // Try to parse and extract readable content
              const parsed = JSON.parse(message.content);
              if (parsed.encryptedContent) {
                // Try base64 decode
                try {
                  const decoded = atob(parsed.encryptedContent);
                  if (decoded && decoded.length > 0 && decoded !== parsed.encryptedContent) {
                    setDecryptedContent(`🔓 ${decoded} (fallback decryption)`);
                    sessionStorage.setItem(cacheKey, decoded);
                  } else {
                    throw new Error('Base64 decode failed');
                  }
                } catch (b64Error) {
                  setDecryptedContent('🔒 Encrypted message (fallback failed)');
                }
              } else {
                setDecryptedContent('🔒 Encrypted message (no content)');
              }
            } catch (parseError) {
              // Try direct base64 decode
              try {
                const directDecode = atob(message.content);
                if (directDecode && directDecode !== message.content) {
                  setDecryptedContent(`🔓 ${directDecode} (direct decode)`);
                  sessionStorage.setItem(cacheKey, directDecode);
                } else {
                  setDecryptedContent('🔒 Encrypted message (all methods failed)');
                }
              } catch (finalError) {
                setDecryptedContent('🔒 Encrypted message (decrypt failed)');
              }
            }
          } finally {
            setIsDecrypting(false);
          }
        } else {
          setDecryptedContent('🔒 Encrypted message (no key available)');
        }
      }
    };

    attemptDecryption();
  }, [message.id, message.content]); // Use message.id for better dependency

  // Listen for global context menu close events
  useEffect(() => {
    const handleCloseContextMenus = () => {
      setContextMenu({ isOpen: false, position: { x: 0, y: 0 } });
    };
    
    document.addEventListener('closeContextMenus', handleCloseContextMenus);
    return () => document.removeEventListener('closeContextMenus', handleCloseContextMenus);
  }, []);

  // Mobile touch handlers for context menu
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;
    
    const touch = e.touches[0];
    // Store exact touch coordinates
    const touchX = touch.clientX;
    const touchY = touch.clientY;
    touchStart.current = { x: touchX, y: touchY };
    
    console.log('Touch started at:', { x: touchX, y: touchY });
    
    // Start long press timer
    longPressTimer.current = setTimeout(() => {
      // Haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      
      // Show context menu at exact touch position
      document.dispatchEvent(new Event('closeContextMenus'));
      setTimeout(() => {
        if (touchStart.current) {
          console.log('Opening context menu at:', touchStart.current);
          setContextMenu({
            isOpen: true,
            position: touchStart.current
          });
        }
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

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  // Message context menu handlers
  const handleReply = () => {
    toast({
      title: "Feature Coming Soon",
      description: "Reply functionality will be available soon.",
    });
  };

  const handleEdit = () => {
    toast({
      title: "Feature Coming Soon",
      description: "Edit message functionality will be available soon.",
    });
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(decryptedContent);
    toast({
      title: "Success",
      description: "Message copied to clipboard!",
    });
  };

  const handlePin = () => {
    toast({
      title: "Feature Coming Soon",
      description: "Pin message functionality will be available soon.",
    });
  };

  const handleForward = () => {
    toast({
      title: "Feature Coming Soon",
      description: "Forward message functionality will be available soon.",
    });
  };

  const handleSelect = () => {
    toast({
      title: "Feature Coming Soon",
      description: "Select message functionality will be available soon.",
    });
  };

  const handleDelete = () => {
    toast({
      title: "Feature Coming Soon",
      description: "Delete message functionality will be available soon.",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
    });
  };


  if (isOwn) {
    return (
      <>
      <div className="flex items-start justify-end message-bubble" data-testid={`message-${message.id}`}>
        <div className={`${isMobile ? 'max-w-[85%]' : 'max-w-xs lg:max-w-md'}`}>
          <div 
            className="bg-primary text-primary-foreground rounded-lg p-3 cursor-pointer"
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Close any existing context menus first
              document.dispatchEvent(new Event('closeContextMenus'));
              setTimeout(() => {
                setContextMenu({
                  isOpen: true,
                  position: { x: e.clientX, y: e.clientY }
                });
              }, 10);
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
            data-testid={`message-bubble-${message.id}`}
          >
            <p className="text-sm" data-testid={`message-content-${message.id}`}>
              {isDecrypting ? '🔓 Decrypting...' : decryptedContent}
            </p>
          </div>
          <div className="flex items-center justify-end space-x-2 mt-1">
            {(message.isEncrypted || isMilitaryEncrypted) && (
              <div title={isMilitaryEncrypted ? "Military-grade encryption" : "Basic encryption"}>
                {isMilitaryEncrypted ? 
                  <Shield className="h-3 w-3 text-green-500" /> :
                  <Lock className="h-3 w-3 text-muted-foreground" />
                }
              </div>
            )}
            <span className="text-xs text-muted-foreground" data-testid={`message-time-${message.id}`}>
              {formatTime(message.createdAt!.toString())}
            </span>
            {/* Message status - simplified for MVP */}
            <CheckCheck className="h-3 w-3 text-green-500" />
          </div>
        </div>
      </div>

      {/* Context Menu for Own Messages */}
      {contextMenu.isOpen && (
        <div 
          className="fixed inset-0 z-[9999]" 
          onClick={() => setContextMenu({ isOpen: false, position: { x: 0, y: 0 } })}
          onContextMenu={(e) => {
            e.preventDefault();
            // Check if the right-click is on a message
            const messageElement = (e.target as HTMLElement).closest('[data-testid^="message-"]');
            if (messageElement) {
              // Close current menu and reopen at new position
              setContextMenu({ isOpen: false, position: { x: 0, y: 0 } });
              setTimeout(() => {
                setContextMenu({
                  isOpen: true,
                  position: { x: e.clientX, y: e.clientY }
                });
              }, 50);
            } else {
              // Just close the menu if not on a message
              setContextMenu({ isOpen: false, position: { x: 0, y: 0 } });
            }
          }}
          style={{ backgroundColor: 'rgba(0,0,0,0.1)' }}
        >
          <div 
            className={`absolute bg-popover border border-border text-popover-foreground ${isMobile ? 'rounded-xl shadow-2xl py-2 min-w-60 context-menu-mobile' : 'rounded-md shadow-xl py-1 min-w-44'}`}
            style={{ 
              left: isMobile ? Math.max(16, Math.min(contextMenu.position.x - 120, window.innerWidth - 260)) : Math.min(contextMenu.position.x, window.innerWidth - 180), 
              top: isMobile ? Math.max(16, Math.min(contextMenu.position.y - 100, window.innerHeight - 380)) : Math.min(contextMenu.position.y, window.innerHeight - 320),
              zIndex: 10000
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className={`flex items-center w-full ${isMobile ? 'px-4 py-3 text-base' : 'px-3 py-2 text-sm'} hover:bg-accent transition-colors touch-manipulation text-popover-foreground`}
              onClick={() => {
                handleReply();
                setContextMenu({ isOpen: false, position: { x: 0, y: 0 } });
              }}
            >
              <Reply className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'} mr-2`} />
              Reply
            </button>
            
            <button
              className={`flex items-center w-full ${isMobile ? 'px-4 py-3 text-base' : 'px-3 py-2 text-sm'} hover:bg-accent transition-colors touch-manipulation text-popover-foreground`}
              onClick={() => {
                handleEdit();
                setContextMenu({ isOpen: false, position: { x: 0, y: 0 } });
              }}
            >
              <Edit className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'} mr-2`} />
              Edit
            </button>

            <button
              className={`flex items-center w-full ${isMobile ? 'px-4 py-3 text-base' : 'px-3 py-2 text-sm'} hover:bg-accent transition-colors touch-manipulation text-popover-foreground`}
              onClick={() => {
                handleCopyText();
                setContextMenu({ isOpen: false, position: { x: 0, y: 0 } });
              }}
            >
              <Copy className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'} mr-2`} />
              Copy Text
            </button>
            
            <button
              className={`flex items-center w-full ${isMobile ? 'px-4 py-3 text-base' : 'px-3 py-2 text-sm'} hover:bg-accent transition-colors touch-manipulation text-popover-foreground`}
              onClick={() => {
                handlePin();
                setContextMenu({ isOpen: false, position: { x: 0, y: 0 } });
              }}
            >
              <Pin className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'} mr-2`} />
              Pin
            </button>
            
            <button
              className={`flex items-center w-full ${isMobile ? 'px-4 py-3 text-base' : 'px-3 py-2 text-sm'} hover:bg-accent transition-colors touch-manipulation text-popover-foreground`}
              onClick={() => {
                handleForward();
                setContextMenu({ isOpen: false, position: { x: 0, y: 0 } });
              }}
            >
              <Forward className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'} mr-2`} />
              Forward
            </button>
            
            <button
              className={`flex items-center w-full ${isMobile ? 'px-4 py-3 text-base' : 'px-3 py-2 text-sm'} hover:bg-accent transition-colors touch-manipulation text-popover-foreground`}
              onClick={() => {
                handleSelect();
                setContextMenu({ isOpen: false, position: { x: 0, y: 0 } });
              }}
            >
              <MousePointer className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'} mr-2`} />
              Select
            </button>

            <div className={`border-t border-border ${isMobile ? 'my-2' : 'my-1'}`}></div>
            <button
              className={`flex items-center w-full ${isMobile ? 'px-4 py-3 text-base' : 'px-3 py-2 text-sm'} text-destructive hover:bg-accent transition-colors touch-manipulation`}
              onClick={() => {
                handleDelete();
                setContextMenu({ isOpen: false, position: { x: 0, y: 0 } });
              }}
            >
              <Trash2 className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'} mr-2`} />
              Delete
            </button>
          </div>
        </div>
      )}
      </>
    );
  }

  return (
    <>
      <div className="flex items-start message-bubble" data-testid={`message-${message.id}`}>
        <div className={`${isMobile ? 'max-w-[85%]' : 'max-w-xs lg:max-w-md'}`}>
          <div 
            className="bg-card border border-border rounded-lg p-3 cursor-pointer"
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Close any existing context menus first
              document.dispatchEvent(new Event('closeContextMenus'));
              setTimeout(() => {
                setContextMenu({
                  isOpen: true,
                  position: { x: e.clientX, y: e.clientY }
                });
              }, 10);
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
            data-testid={`message-bubble-${message.id}`}
          >
            <p className="text-sm" data-testid={`message-content-${message.id}`}>
              {isDecrypting ? '🔓 Decrypting...' : decryptedContent}
            </p>
          </div>
          <div className="flex items-center space-x-2 mt-1">
            <span className="text-xs text-muted-foreground" data-testid={`message-time-${message.id}`}>
              {formatTime(message.createdAt!.toString())}
            </span>
            {(message.isEncrypted || isMilitaryEncrypted) && (
              <div title={isMilitaryEncrypted ? "Military-grade encryption" : "Basic encryption"}>
                {isMilitaryEncrypted ? 
                  <Shield className="h-3 w-3 text-green-500" /> :
                  <Lock className="h-3 w-3 text-muted-foreground" />
                }
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Context Menu for Messages */}
      {contextMenu.isOpen && (
        <div 
          className="fixed inset-0 z-[9999]" 
          onClick={() => setContextMenu({ isOpen: false, position: { x: 0, y: 0 } })}
          onContextMenu={(e) => {
            e.preventDefault();
            // Check if the right-click is on a message
            const messageElement = (e.target as HTMLElement).closest('[data-testid^="message-"]');
            if (messageElement) {
              // Close current menu and reopen at new position
              setContextMenu({ isOpen: false, position: { x: 0, y: 0 } });
              setTimeout(() => {
                setContextMenu({
                  isOpen: true,
                  position: { x: e.clientX, y: e.clientY }
                });
              }, 50);
            } else {
              // Just close the menu if not on a message
              setContextMenu({ isOpen: false, position: { x: 0, y: 0 } });
            }
          }}
          style={{ backgroundColor: 'rgba(0,0,0,0.1)' }}
        >
          <div 
            className={`absolute bg-popover border border-border text-popover-foreground ${isMobile ? 'rounded-xl shadow-2xl py-2 min-w-60 context-menu-mobile' : 'rounded-md shadow-xl py-1 min-w-44'}`}
            style={{ 
              left: isMobile ? Math.max(8, Math.min(contextMenu.position.x, window.innerWidth - 250)) : Math.min(contextMenu.position.x, window.innerWidth - 180), 
              top: isMobile ? Math.max(8, Math.min(contextMenu.position.y, window.innerHeight - (isOwn ? 400 : 350))) : Math.min(contextMenu.position.y, window.innerHeight - (isOwn ? 320 : 280)),
              zIndex: 10000
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className={`flex items-center w-full ${isMobile ? 'px-4 py-3 text-base' : 'px-3 py-2 text-sm'} hover:bg-accent transition-colors touch-manipulation text-popover-foreground`}
              onClick={() => {
                handleReply();
                setContextMenu({ isOpen: false, position: { x: 0, y: 0 } });
              }}
            >
              <Reply className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'} mr-2`} />
              Reply
            </button>
            
            {isOwn && (
              <button
                className={`flex items-center w-full ${isMobile ? 'px-4 py-3 text-base' : 'px-3 py-2 text-sm'} hover:bg-accent transition-colors touch-manipulation text-popover-foreground`}
                onClick={() => {
                  handleEdit();
                  setContextMenu({ isOpen: false, position: { x: 0, y: 0 } });
                }}
              >
                <Edit className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'} mr-2`} />
                Edit
              </button>
            )}

            <button
              className={`flex items-center w-full ${isMobile ? 'px-4 py-3 text-base' : 'px-3 py-2 text-sm'} hover:bg-accent transition-colors touch-manipulation text-popover-foreground`}
              onClick={() => {
                handleCopyText();
                setContextMenu({ isOpen: false, position: { x: 0, y: 0 } });
              }}
            >
              <Copy className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'} mr-2`} />
              Copy Text
            </button>
            
            <button
              className={`flex items-center w-full ${isMobile ? 'px-4 py-3 text-base' : 'px-3 py-2 text-sm'} hover:bg-accent transition-colors touch-manipulation text-popover-foreground`}
              onClick={() => {
                handlePin();
                setContextMenu({ isOpen: false, position: { x: 0, y: 0 } });
              }}
            >
              <Pin className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'} mr-2`} />
              Pin
            </button>
            
            <button
              className={`flex items-center w-full ${isMobile ? 'px-4 py-3 text-base' : 'px-3 py-2 text-sm'} hover:bg-accent transition-colors touch-manipulation text-popover-foreground`}
              onClick={() => {
                handleForward();
                setContextMenu({ isOpen: false, position: { x: 0, y: 0 } });
              }}
            >
              <Forward className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'} mr-2`} />
              Forward
            </button>
            
            <button
              className={`flex items-center w-full ${isMobile ? 'px-4 py-3 text-base' : 'px-3 py-2 text-sm'} hover:bg-accent transition-colors touch-manipulation text-popover-foreground`}
              onClick={() => {
                handleSelect();
                setContextMenu({ isOpen: false, position: { x: 0, y: 0 } });
              }}
            >
              <MousePointer className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'} mr-2`} />
              Select
            </button>

            <div className={`border-t border-border ${isMobile ? 'my-2' : 'my-1'}`}></div>
            <button
              className={`flex items-center w-full ${isMobile ? 'px-4 py-3 text-base' : 'px-3 py-2 text-sm'} transition-colors hover:bg-accent cursor-not-allowed text-destructive touch-manipulation`}
              onClick={() => {
                if (isOwn) {
                  handleDelete();
                  setContextMenu({ isOpen: false, position: { x: 0, y: 0 } });
                } else {
                  // Show toast that only own messages can be deleted
                  handleDelete(); // This will show the appropriate message
                  setContextMenu({ isOpen: false, position: { x: 0, y: 0 } });
                }
              }}
            >
              <Trash2 className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'} mr-2`} />
              Delete
            </button>
          </div>
        </div>
      )}
    </>
  );
}
