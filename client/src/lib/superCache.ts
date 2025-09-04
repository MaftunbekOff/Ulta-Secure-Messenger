
// Ultra-fast caching system for instant data access
interface SuperCacheItem<T> {
  data: T;
  timestamp: number;
  hitCount: number;
  priority: 'high' | 'medium' | 'low';
}

class SuperCache<T> {
  private cache = new Map<string, SuperCacheItem<T>>();
  private maxSize = 50000; // 50k items
  private ttl = 24 * 60 * 60 * 1000; // 24 hours

  set(key: string, data: T, priority: 'high' | 'medium' | 'low' = 'medium'): void {
    // Auto-cleanup if cache is full
    if (this.cache.size >= this.maxSize) {
      this.cleanup();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      hitCount: 0,
      priority
    });

    // Persist high priority items to IndexedDB for long-term storage
    if (priority === 'high') {
      this.persistToIndexedDB(key, data);
    }
  }

  get(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    // Check if expired
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Update hit count for popularity tracking
    item.hitCount++;
    return item.data;
  }

  private cleanup(): void {
    const entries = Array.from(this.cache.entries());
    
    // Sort by priority and hit count
    entries.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const aPriority = priorityOrder[a[1].priority];
      const bPriority = priorityOrder[b[1].priority];
      
      if (aPriority !== bPriority) return bPriority - aPriority;
      return b[1].hitCount - a[1].hitCount;
    });

    // Remove bottom 25% of items
    const toRemove = entries.slice(Math.floor(entries.length * 0.75));
    toRemove.forEach(([key]) => this.cache.delete(key));
  }

  private async persistToIndexedDB(key: string, data: T): Promise<void> {
    try {
      const request = indexedDB.open('SuperCache', 1);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['cache'], 'readwrite');
        const store = transaction.objectStore('cache');
        store.put({ key, data, timestamp: Date.now() });
      };
    } catch (error) {
      // Silent fallback
    }
  }

  // Get cache statistics
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRatio: this.calculateHitRatio(),
      memoryUsage: `~${Math.round(this.cache.size * 0.5)}KB`
    };
  }

  private calculateHitRatio(): number {
    const totalHits = Array.from(this.cache.values())
      .reduce((sum, item) => sum + item.hitCount, 0);
    return totalHits / this.cache.size || 0;
  }
}

// Global instances for different data types
export const userCache = new SuperCache<any>();
export const chatCache = new SuperCache<any>();
export const messageCache = new SuperCache<any>();

// Pre-warm cache with frequently accessed data
export const preWarmCache = async () => {
  try {
    // Pre-load user's recent chats
    const recentChats = localStorage.getItem('recentChats');
    if (recentChats) {
      const chats = JSON.parse(recentChats);
      chats.forEach((chat: any, index: number) => {
        chatCache.set(`chat_${chat.id}`, chat, index < 5 ? 'high' : 'medium');
      });
    }
  } catch (error) {
    // Silent error handling
  }
};
