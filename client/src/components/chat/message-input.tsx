import { useState, useRef, KeyboardEvent } from "react";
import { Send, Paperclip, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface MessageInputProps {
  onSendMessage: (content: string) => void;
  onTyping?: () => void;
  disabled?: boolean;
  isMobile?: boolean;
}

export function MessageInput({ onSendMessage, onTyping, disabled, isMobile = false }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSendMessage = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage("");
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInputChange = (value: string) => {
    setMessage(value);
    onTyping?.();
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 128) + "px";
    }
  };

  return (
    <div className={`${isMobile ? 'p-3' : 'p-4'} border-t border-border bg-card`}>
      <div className={`flex items-end ${isMobile ? 'space-x-2' : 'space-x-3'}`}>
        <Button
          variant="ghost"
          size="sm"
          className={`${isMobile ? 'p-3 h-12 w-12' : 'p-2 h-auto'}`}
          data-testid="button-attach"
        >
          <Paperclip className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'} text-muted-foreground`} />
        </Button>
        
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            placeholder="Type a message..."
            value={message}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`resize-none ${isMobile ? 'min-h-[52px] text-base' : 'min-h-[48px]'} max-h-32 pr-12`}
            rows={1}
            disabled={disabled}
            data-testid="input-message"
          />
          <Button
            variant="ghost"
            size="sm"
            className={`absolute right-3 ${isMobile ? 'bottom-4 p-2' : 'bottom-3 p-1'} h-auto`}
            data-testid="button-emoji"
          >
            <Smile className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'} text-muted-foreground hover:text-foreground`} />
          </Button>
        </div>
        
        <Button
          onClick={handleSendMessage}
          disabled={!message.trim() || disabled}
          size="sm"
          className={`${isMobile ? 'p-3 h-12 w-12' : 'p-3 h-auto'}`}
          data-testid="button-send"
        >
          <Send className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'}`} />
        </Button>
      </div>
    </div>
  );
}

export default MessageInput;
