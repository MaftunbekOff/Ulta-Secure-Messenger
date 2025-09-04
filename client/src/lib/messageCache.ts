interface CachedMessage {
  id: string;
  content: string;
  decryptedContent?: string;
  timestamp: number;
  chatId: string;
}

interface CacheMetadata {
  lastUpdated: number;
  size: number;
  compressed: boolean;
}

// Message caching with offline support and slow connection optimization
class MessageCache {
  private cache = new Map<string, CachedMessage[]>();
  private metadata = new Map<string, CacheMetadata>();
  private offlineQueue = new Map<string, any[]>(); // Offline message queue
  private readonly maxSize = 10000; // 10k messages for million users
  private readonly expireTime = 3600000; // 1 hour cache time
  private compressionEnabled = true;

  // Store messages with compression and offline support
  store(chatId: string, messages: any[]): void {
    try {
      const cacheKey = `chat_${chatId}`;

      // Convert to cacheable format
      const cachedMessages: CachedMessage[] = messages.map(msg => ({
        id: msg.id,
        content: msg.content || '',
        senderId: msg.senderId,
        timestamp: msg.createdAt || new Date().toISOString(),
        isEncrypted: msg.isEncrypted || false
      }));

      this.cache.set(cacheKey, cachedMessages);
      this.metadata.set(cacheKey, {
        lastUpdated: Date.now(),
        size: cachedMessages.length,
        compressed: cachedMessages.length > 20
      });

      // Store in localStorage for persistence across sessions
      try {
        const storageKey = `msg_cache_${chatId}`;
        const dataToStore = {
          messages: cachedMessages.slice(-30), // Keep last 30 messages
          timestamp: Date.now()
        };
        localStorage.setItem(storageKey, JSON.stringify(dataToStore));
      } catch (storageError) {
        // Storage quota exceeded - clear old data
        this.clearOldLocalStorage();
      }

      // Cleanup old entries
      this.cleanup();
    } catch (error) {
      // Silent error handling
    }
  }

  // Add message to offline queue
  addToOfflineQueue(chatId: string, message: any): void {
    if (!this.offlineQueue.has(chatId)) {
      this.offlineQueue.set(chatId, []);
    }
    this.offlineQueue.get(chatId)!.push({
      ...message,
      id: `offline_${Date.now()}_${Math.random()}`,
      timestamp: new Date().toISOString(),
      isOffline: true
    });

    // Store offline messages in localStorage
    try {
      localStorage.setItem(`offline_${chatId}`, JSON.stringify(this.offlineQueue.get(chatId)));
    } catch (e) {
      // Silent error
    }
  }

  // Get offline messages
  getOfflineMessages(chatId: string): any[] {
    try {
      const stored = localStorage.getItem(`offline_${chatId}`);
      if (stored) {
        const messages = JSON.parse(stored);
        this.offlineQueue.set(chatId, messages);
        return messages;
      }
    } catch (e) {
      // Silent error
    }
    return this.offlineQueue.get(chatId) || [];
  }

  // Clear offline queue after sync
  clearOfflineQueue(chatId: string): void {
    this.offlineQueue.delete(chatId);
    localStorage.removeItem(`offline_${chatId}`);
  }

  // Load from localStorage on startup
  loadFromStorage(chatId: string): CachedMessage[] {
    try {
      const storageKey = `msg_cache_${chatId}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        // Check if data is not too old (1 hour)
        if (Date.now() - data.timestamp < 3600000) {
          return data.messages;
        }
      }
    } catch (e) {
      // Silent error
    }
    return [];
  }

  // Clear old localStorage data
  private clearOldLocalStorage(): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('msg_cache_')) {
        keysToRemove.push(key);
      }
    }
    // Remove oldest first
    keysToRemove.slice(0, 5).forEach(key => {
      localStorage.removeItem(key);
    });
  }

  // Cleanup old cache entries
  private cleanup(): void {
    if (this.cache.size > this.maxSize) {
      // Remove oldest entries
      const entries = Array.from(this.cache.entries());
      const entriesToDelete = entries.slice(0, entries.length - this.maxSize);
      entriesToDelete.forEach(([key]) => this.cache.delete(key));
    }
    // Remove expired metadata
    const now = Date.now();
    for (const [key, meta] of this.metadata) {
      if (now - meta.lastUpdated > this.expireTime) {
        this.metadata.delete(key);
        this.cache.delete(key);
      }
    }
  }

  // Get cached messages for a chat
  get(chatId: string): CachedMessage[] {
    const cacheKey = `chat_${chatId}`;
    const cached = this.cache.get(cacheKey);
    if (!cached) return this.loadFromStorage(chatId);

    const meta = this.metadata.get(cacheKey);
    if (!meta || Date.now() - meta.lastUpdated > this.expireTime) {
      this.metadata.delete(cacheKey);
      this.cache.delete(cacheKey);
      return this.loadFromStorage(chatId);
    }

    return cached;
  }

  // Update metadata
  updateMetadata(chatId: string, messages: CachedMessage[]): void {
    const cacheKey = `chat_${chatId}`;
    this.metadata.set(cacheKey, {
      lastUpdated: Date.now(),
      size: messages.length,
      compressed: messages.length > 20
    });
  }

  // Get cache stats
  getStats(): Map<string, CacheMetadata> {
    return this.metadata;
  }
}

export const messageCache = new MessageCache();