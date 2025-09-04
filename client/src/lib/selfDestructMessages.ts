
// Xabarlar o'z-o'zidan yo'q qilish tizimi
// Belgilangan vaqtdan keyin xabarlar avtomatik o'chiriladi

interface SelfDestructConfig {
  timeToLive: number; // milliseconds
  wipeAfterRead: boolean;
  maxReadCount: number;
}

export class SelfDestructMessages {
  private static instance: SelfDestructMessages;
  private destructTimers: Map<string, NodeJS.Timeout> = new Map();
  private messageReadCounts: Map<string, number> = new Map();

  static getInstance(): SelfDestructMessages {
    if (!SelfDestructMessages.instance) {
      SelfDestructMessages.instance = new SelfDestructMessages();
    }
    return SelfDestructMessages.instance;
  }

  // O'z-o'zidan yo'q qilinadigan xabar yaratish
  createSelfDestructMessage(
    messageId: string, 
    config: SelfDestructConfig,
    onDestruct: (messageId: string) => void
  ): void {
    // Vaqt bo'yicha yo'q qilish
    if (config.timeToLive > 0) {
      const timer = setTimeout(() => {
        this.destroyMessage(messageId, onDestruct);
      }, config.timeToLive);
      
      this.destructTimers.set(messageId, timer);
    }

    // O'qish sonini boshlash
    if (config.wipeAfterRead) {
      this.messageReadCounts.set(messageId, 0);
    }
  }

  // Xabar o'qilganda
  onMessageRead(messageId: string, config: SelfDestructConfig, onDestruct: (messageId: string) => void): void {
    if (!config.wipeAfterRead) return;

    const currentCount = this.messageReadCounts.get(messageId) || 0;
    const newCount = currentCount + 1;
    
    this.messageReadCounts.set(messageId, newCount);

    if (newCount >= config.maxReadCount) {
      // Bir necha soniya kutib, keyin o'chirish
      setTimeout(() => {
        this.destroyMessage(messageId, onDestruct);
      }, 2000);
    }
  }

  // Xabarni yo'q qilish
  private destroyMessage(messageId: string, onDestruct: (messageId: string) => void): void {
    // Taymer tozalash
    const timer = this.destructTimers.get(messageId);
    if (timer) {
      clearTimeout(timer);
      this.destructTimers.delete(messageId);
    }

    // O'qish hisobini tozalash
    this.messageReadCounts.delete(messageId);

    // Xotiradan o'chirish
    this.wipeFromMemory(messageId);

    // Callback chaqirish
    onDestruct(messageId);

    console.log(`🔥 Message ${messageId} self-destructed for security`);
  }

  // Xotiradan butunlay o'chirish
  private wipeFromMemory(messageId: string): void {
    // DOM'dan o'chirish
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
      // Element mazmunini tozalash
      messageElement.innerHTML = '🔥 <em>Bu xabar o\'z-o\'zidan yo\'q qilindi</em>';
      
      // 3 soniyadan keyin butunlay o'chirish
      setTimeout(() => {
        messageElement.remove();
      }, 3000);
    }

    // LocalStorage'dan tozalash
    const storageKeys = Object.keys(localStorage);
    storageKeys.forEach(key => {
      if (key.includes(messageId)) {
        localStorage.removeItem(key);
      }
    });
  }

  // Barcha vaqtinchalik xabarlarni tozalash
  cleanup(): void {
    this.destructTimers.forEach((timer) => clearTimeout(timer));
    this.destructTimers.clear();
    this.messageReadCounts.clear();
  }
}

// Oldindan belgilangan konfiguratsiyalar
export const DESTRUCT_CONFIGS = {
  // 30 soniya keyin o'chadi
  QUICK_BURN: {
    timeToLive: 30 * 1000,
    wipeAfterRead: false,
    maxReadCount: 0
  },
  
  // 5 daqiqa keyin yoki 1 marta o'qilgandan keyin
  SECRET_MESSAGE: {
    timeToLive: 5 * 60 * 1000,
    wipeAfterRead: true,
    maxReadCount: 1
  },
  
  // Faqat o'qilgandan keyin (3 marta)
  READ_ONCE: {
    timeToLive: 0,
    wipeAfterRead: true,
    maxReadCount: 3
  },
  
  // Maksimal xavfsiz: 1 daqiqa yoki birinchi o'qishdan keyin
  ULTRA_SECURE: {
    timeToLive: 60 * 1000,
    wipeAfterRead: true,
    maxReadCount: 1
  }
};

export const selfDestructMessages = SelfDestructMessages.getInstance();
