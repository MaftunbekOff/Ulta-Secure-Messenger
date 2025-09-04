
interface CachedMessage {
  id: string;
  content: string;
  decryptedContent?: string;
  timestamp: number;
  chatId: string;
}

class MessageCache {
  private cache = new Map<string, CachedMessage>();
  private decryptionCache = new Map<string, string>();
  private chatMessagesCache = new Map<string, CachedMessage[]>();
  
  // Cache expiry time (5 minutes)
  private readonly CACHE_EXPIRY = 5 * 60 * 1000;

  // Add message to cache
  addMessage(chatId: string, message: CachedMessage): void {
    const key = `${chatId}:${message.id}`;
    this.cache.set(key, {
      ...message,
      timestamp: Date.now()
    });

    // Update chat messages cache
    const existingMessages = this.chatMessagesCache.get(chatId) || [];
    const updatedMessages = [...existingMessages, message];
    this.chatMessagesCache.set(chatId, updatedMessages);
  }

  // Get cached message
  getMessage(chatId: string, messageId: string): CachedMessage | null {
    const key = `${chatId}:${messageId}`;
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    // Check if cache is expired
    if (Date.now() - cached.timestamp > this.CACHE_EXPIRY) {
      this.cache.delete(key);
      return null;
    }
    
    return cached;
  }

  // Cache decrypted content
  setDecryptedContent(messageId: string, content: string): void {
    this.decryptionCache.set(messageId, content);
  }

  // Get cached decrypted content
  getDecryptedContent(messageId: string): string | null {
    return this.decryptionCache.get(messageId) || null;
  }

  // Get all messages for a chat
  getChatMessages(chatId: string): CachedMessage[] {
    const cached = this.chatMessagesCache.get(chatId);
    if (!cached) return [];

    // Filter out expired messages
    const now = Date.now();
    const validMessages = cached.filter(msg => 
      now - msg.timestamp < this.CACHE_EXPIRY
    );

    if (validMessages.length !== cached.length) {
      this.chatMessagesCache.set(chatId, validMessages);
    }

    return validMessages;
  }

  // Clear cache for specific chat
  clearChatCache(chatId: string): void {
    this.chatMessagesCache.delete(chatId);
    
    // Remove individual message cache entries
    for (const [key] of this.cache) {
      if (key.startsWith(`${chatId}:`)) {
        this.cache.delete(key);
      }
    }
  }

  // Clear all cache
  clearAll(): void {
    this.cache.clear();
    this.decryptionCache.clear();
    this.chatMessagesCache.clear();
  }

  // Get cache stats for debugging
  getCacheStats() {
    return {
      messageCount: this.cache.size,
      decryptionCount: this.decryptionCache.size,
      chatCount: this.chatMessagesCache.size
    };
  }
}

export const messageCache = new MessageCache();
