import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Lock, Shield, Clock } from 'lucide-react';

interface MessageBubbleProps {
  message: {
    id: string;
    content: string;
    senderId: string;
    timestamp: number;
    deliveryStatus?: 'sending' | 'delivered' | 'read' | 'failed';
    isEncrypted?: boolean;
    securityLevel?: number;
    isSelfDestruct?: boolean;
    selfDestructTime?: number;
  };
  isOwn: boolean;
  senderName?: string;
  senderAvatar?: string;
}

export const MessageBubble = ({ message, isOwn, senderName, senderAvatar }: MessageBubbleProps) => {
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('uz-UZ', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSecurityBadge = () => {
    if (!message.isEncrypted) return null;

    const level = message.securityLevel || 1;
    const colors = {
      1: 'bg-blue-500',
      2: 'bg-yellow-500', 
      3: 'bg-red-500'
    };

    return (
      <Badge variant="secondary" className="text-xs">
        <Shield className="w-3 h-3 mr-1" />
        {level}-qatlam
      </Badge>
    );
  };

  const getDeliveryStatus = () => {
    const status = message.deliveryStatus;
    if (!status || status === 'delivered') return null;

    const statusConfig = {
      sending: { icon: Clock, color: 'text-yellow-500', text: 'Yuborilmoqda...' },
      failed: { icon: Clock, color: 'text-red-500', text: 'Yuborilmadi' },
      read: { icon: Clock, color: 'text-green-500', text: 'O\'qildi' }
    };

    const config = statusConfig[status];
    if (!config) return null;

    const Icon = config.icon;
    return (
      <div className={`flex items-center text-xs ${config.color} mt-1`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.text}
      </div>
    );
  };

  return (
    <div className={`flex mb-4 ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-xs lg:max-w-md ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
        {!isOwn && (
          <Avatar className="w-8 h-8 mr-2">
            <AvatarImage src={senderAvatar} />
            <AvatarFallback>{senderName?.charAt(0) || 'U'}</AvatarFallback>
          </Avatar>
        )}

        <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
          {!isOwn && senderName && (
            <span className="text-xs text-muted-foreground mb-1">{senderName}</span>
          )}

          <div
            className={`px-4 py-2 rounded-lg ${
              isOwn
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              {message.isEncrypted && <Lock className="w-3 h-3" />}
              {message.isSelfDestruct && (
                <div className="flex items-center text-xs">
                  <Clock className="w-3 h-3 mr-1" />
                  {message.selfDestructTime}s
                </div>
              )}
            </div>

            <p className="text-sm whitespace-pre-wrap">{message.content}</p>

            <div className="flex items-center justify-between mt-2 gap-2">
              <span className="text-xs opacity-70">
                {formatTime(message.timestamp)}
              </span>
              {getSecurityBadge()}
            </div>

            {getDeliveryStatus()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MessageBubble;
import React from 'react';
import { cn } from '@/lib/utils';

interface MessageBubbleProps {
  message: {
    id: string;
    content: string;
    userId: string;
    timestamp: Date;
    encrypted?: boolean;
  };
  isOwn: boolean;
  senderName?: string;
}

export function MessageBubble({ message, isOwn, senderName }: MessageBubbleProps) {
  return (
    <div className={cn(
      "flex w-full mb-4",
      isOwn ? "justify-end" : "justify-start"
    )}>
      <div className={cn(
        "max-w-[70%] px-4 py-2 rounded-lg break-words",
        isOwn 
          ? "bg-blue-600 text-white rounded-br-none" 
          : "bg-gray-200 text-gray-900 rounded-bl-none"
      )}>
        {!isOwn && senderName && (
          <div className="text-xs font-semibold mb-1 opacity-70">
            {senderName}
          </div>
        )}
        <div className="text-sm">
          {message.content}
        </div>
        <div className={cn(
          "text-xs mt-1 opacity-70 flex items-center gap-1",
          isOwn ? "text-blue-100" : "text-gray-500"
        )}>
          {message.encrypted && (
            <span className="text-green-500">🔒</span>
          )}
          {new Date(message.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </div>
      </div>
    </div>
  );
}
