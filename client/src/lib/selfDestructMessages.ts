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
  // Add a map to store message data for more robust checking
  private messages: Map<string, { destructTime: number, message: any }> = new Map();


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
    messageData: any, // Added to store message content
    onDestruct: (messageId: string) => void
  ): void {
    const destructTime = config.timeToLive > 0 ? Date.now() + config.timeToLive : Infinity;
    this.messages.set(messageId, { destructTime, message: messageData });

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

    // Xabarni messages map'dan o'chirish
    this.messages.delete(messageId);

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
    this.messages.clear(); // Clear the messages map as well
  }

  // Check if message should self-destruct (enhanced for security breaches)
  shouldDestruct(messageId: string): boolean {
    const message = this.messages.get(messageId);
    if (!message) return false;

    const now = Date.now();

    // Check for security breach indicators
    if (this.detectSecurityBreach()) {
      console.warn('🚨 Security breach detected - initiating emergency destruction');
      this.emergencyDestructAll();
      return true;
    }

    return now >= message.destructTime;
  }

  // Detect potential security breach
  private detectSecurityBreach(): boolean {
    try {
      // Check if dev tools are open
      const devtools = window.outerHeight - window.innerHeight > 160 ||
                      window.outerWidth - window.innerWidth > 160;

      // Check for suspicious localStorage access
      const suspiciousAccess = this.checkSuspiciousAccess();

      // Check for memory inspection attempts
      const memoryInspection = this.detectMemoryInspection();

      return devtools || suspiciousAccess || memoryInspection;
    } catch (error) {
      return false;
    }
  }

  // Check for suspicious localStorage access patterns
  private checkSuspiciousAccess(): boolean {
    const accessCount = parseInt(localStorage.getItem('security_access_count') || '0');
    const lastAccess = parseInt(localStorage.getItem('security_last_access') || '0');
    const now = Date.now();

    // If too many access attempts in short time
    if (accessCount > 10 && (now - lastAccess) < 5000) {
      return true;
    }

    // Update counters
    localStorage.setItem('security_access_count', (accessCount + 1).toString());
    localStorage.setItem('security_last_access', now.toString());

    return false;
  }

  // Detect memory inspection attempts
  private detectMemoryInspection(): boolean {
    // Check for common debugging variables
    const suspiciousGlobals = ['__REACT_DEVTOOLS_GLOBAL_HOOK__', '__VUE_DEVTOOLS_GLOBAL_HOOK__'];
    return suspiciousGlobals.some(global => window.hasOwnProperty(global));
  }

  // Emergency destroy all messages
  private emergencyDestructAll(): void {
    console.warn('🔥 Emergency destruction initiated');

    // Clear all cached messages
    this.messages.clear();

    // Clear localStorage
    Object.keys(localStorage).forEach(key => {
      if (key.includes('message') || key.includes('chat') || key.includes('ultrasecure')) {
        localStorage.removeItem(key);
      }
    });

    // Clear sessionStorage
    sessionStorage.clear();

    // Overwrite memory with dummy data
    this.overwriteMemory();
  }

  // Overwrite memory with dummy data to prevent recovery
  private overwriteMemory(): void {
    const dummyData = Array(1000).fill('DUMMY_SECURE_DATA_' + Math.random());

    // Store dummy data to overwrite memory
    for (let i = 0; i < 100; i++) {
      localStorage.setItem(`dummy_${i}`, JSON.stringify(dummyData));
      setTimeout(() => localStorage.removeItem(`dummy_${i}`), 100);
    }
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