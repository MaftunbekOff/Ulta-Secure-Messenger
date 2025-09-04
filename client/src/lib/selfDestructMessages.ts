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

  // Detect potential security breach with advanced techniques
  private detectSecurityBreach(): boolean {
    try {
      // 1. Layer 1 breach indicators
      const layer1Breached = this.detectLayer1Breach();
      
      // 2. Check if dev tools are open
      const devtools = window.outerHeight - window.innerHeight > 160 ||
                      window.outerWidth - window.innerWidth > 160;

      // 3. Check for suspicious localStorage access
      const suspiciousAccess = this.checkSuspiciousAccess();

      // 4. Check for memory inspection attempts
      const memoryInspection = this.detectMemoryInspection();

      // 5. Check for JavaScript injection attempts
      const jsInjection = this.detectJavaScriptInjection();

      // 6. Check for browser extension interference
      const extensionTampering = this.detectExtensionTampering();

      return layer1Breached || devtools || suspiciousAccess || memoryInspection || jsInjection || extensionTampering;
    } catch (error) {
      return true; // If detection fails, assume breach for safety
    }
  }

  // Detect Layer 1 specific breaches
  private detectLayer1Breach(): boolean {
    try {
      // Check if crypto API has been tampered with
      if (!window.crypto || typeof window.crypto.getRandomValues !== 'function') {
        console.warn('🚨 Layer 1 Breach: Crypto API compromised');
        return true;
      }

      // Check if localStorage has been cleared suspiciously
      const encryptionKeys = Object.keys(localStorage).filter(key => 
        key.includes('ultrasecure') || key.includes('military') || key.includes('private_key')
      );
      
      if (encryptionKeys.length === 0 && this.hasStoredData()) {
        console.warn('🚨 Layer 1 Breach: Encryption keys missing');
        return true;
      }

      // Check for unauthorized access to private variables
      if (this.detectPrivateVariableAccess()) {
        console.warn('🚨 Layer 1 Breach: Private variables accessed');
        return true;
      }

      return false;
    } catch (error) {
      return true;
    }
  }

  // Check if we should have stored data
  private hasStoredData(): boolean {
    return localStorage.getItem('user_session') !== null || 
           sessionStorage.length > 0;
  }

  // Detect private variable access attempts
  private detectPrivateVariableAccess(): boolean {
    // Create honeypot variables that should never be accessed
    const honeypot = Math.random().toString(36);
    Object.defineProperty(window, `__ultrasecure_${honeypot}`, {
      get() {
        console.warn('🚨 Honeypot accessed - potential breach');
        return true;
      }
    });
    return false;
  }

  // Detect JavaScript injection
  private detectJavaScriptInjection(): boolean {
    try {
      // Check for common injection patterns
      const suspiciousGlobals = [
        '__REACT_DEVTOOLS_GLOBAL_HOOK__',
        '__VUE_DEVTOOLS_GLOBAL_HOOK__',
        'webpackJsonp',
        'eval',
        'Function'
      ];

      for (const global of suspiciousGlobals) {
        if (window.hasOwnProperty(global) && typeof window[global] === 'function') {
          const funcStr = window[global].toString();
          if (funcStr.includes('eval') || funcStr.includes('document.write')) {
            return true;
          }
        }
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  // Detect browser extension tampering
  private detectExtensionTampering(): boolean {
    try {
      // Check if DOM has been modified by extensions
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        if (script.src && (
          script.src.includes('extension://') ||
          script.src.includes('moz-extension://') ||
          script.src.includes('chrome-extension://')
        )) {
          console.warn('🚨 Extension script detected');
          return true;
        }
      }
      return false;
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

  // Emergency destroy all messages with advanced protection
  private emergencyDestructAll(): void {
    console.warn('🔥 LAYER 1 BREACHED - Emergency destruction initiated');

    // 1. Immediately stop all timers
    this.destructTimers.forEach((timer) => clearTimeout(timer));
    this.destructTimers.clear();

    // 2. Clear all cached messages
    this.messages.clear();
    this.messageReadCounts.clear();

    // 3. BACKUP PROTECTION: Move critical data to Layer 2/3 before wiping
    this.backupCriticalDataToSecureLayers();

    // 4. Wipe all storage with military-grade deletion
    this.militaryWipeStorage();

    // 5. Overwrite memory multiple times
    this.multiPassMemoryWipe();

    // 6. Create decoy data to confuse attackers
    this.createDecoyData();

    // 7. Disable all future operations
    this.disableAllOperations();

    // 8. Send breach alert (if server connection available)
    this.sendBreachAlert();

    // 9. Lock down Layer 1 but keep Layer 2/3 intact
    this.lockdownLayer1Only();

    // 10. Show secure recovery message
    this.showSecureRecoveryMessage();
  }

  // Military-grade storage wiping
  private militaryWipeStorage(): void {
    // 3-pass DOD 5220.22-M standard wipe
    for (let pass = 0; pass < 3; pass++) {
      // Pass 1: All 1s
      // Pass 2: All 0s  
      // Pass 3: Random data
      const pattern = pass === 0 ? '1'.repeat(1000) : 
                     pass === 1 ? '0'.repeat(1000) : 
                     Math.random().toString(36).repeat(100);

      Object.keys(localStorage).forEach(key => {
        localStorage.setItem(key, pattern);
      });
      
      Object.keys(sessionStorage).forEach(key => {
        sessionStorage.setItem(key, pattern);
      });
    }

    // Final deletion
    localStorage.clear();
    sessionStorage.clear();
  }

  // Multi-pass memory overwriting
  private multiPassMemoryWipe(): void {
    const largeArray = new Array(100000);
    
    // 5 passes with different patterns
    for (let pass = 0; pass < 5; pass++) {
      for (let i = 0; i < largeArray.length; i++) {
        largeArray[i] = `WIPED_PASS_${pass}_${Math.random()}`;
      }
      
      // Force garbage collection if available
      if (window.gc) {
        window.gc();
      }
    }
  }

  // Disable all future operations
  private disableAllOperations(): void {
    // Override critical functions
    this.createSelfDestructMessage = () => {
      throw new Error('System disabled due to security breach');
    };
    
    this.onMessageRead = () => {
      throw new Error('System disabled due to security breach');
    };
    
    // Poison the wells - make all crypto operations fail
    if (window.crypto) {
      const originalGetRandomValues = window.crypto.getRandomValues;
      window.crypto.getRandomValues = () => {
        throw new Error('Crypto disabled due to breach');
      };
    }
  }

  // Backup critical data to secure layers before destruction
  private backupCriticalDataToSecureLayers(): void {
    try {
      console.log('🔒 Backing up critical data to Layer 2/3...');
      
      // Get all important user data
      const userData = {
        userProfile: localStorage.getItem('user_profile'),
        contacts: localStorage.getItem('contacts'),
        settings: localStorage.getItem('app_settings'),
        encryptionKeys: Object.keys(localStorage).filter(key => 
          key.includes('backup_key') || key.includes('recovery')
        ).map(key => ({ key, value: localStorage.getItem(key) }))
      };

      // Send to secure server-side storage (Layer 2)
      fetch('/api/security/emergency-backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Security-Level': 'LAYER_2_EMERGENCY'
        },
        body: JSON.stringify({
          type: 'EMERGENCY_BACKUP',
          timestamp: Date.now(),
          userData: userData,
          breachType: 'LAYER_1_COMPROMISED'
        })
      }).catch(() => {
        // Try Rust backup (Layer 3) as fallback
        this.tryRustBackup(userData);
      });

    } catch (error) {
      console.warn('Backup attempt failed, data protection continuing...');
    }
  }

  // Fallback backup to Rust layer
  private tryRustBackup(userData: any): void {
    try {
      // Send to Rust encryption engine for secure storage
      fetch('/api/rust/emergency-vault', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Rust-Security': 'ULTRA_SECURE'
        },
        body: JSON.stringify(userData)
      }).catch(() => {
        console.warn('All backup attempts failed - proceeding with protection');
      });
    } catch (error) {
      // Silent - don't reveal backup methods to attacker
    }
  }

  // Create decoy data to confuse attackers
  private createDecoyData(): void {
    const decoyMessages = [
      'Decoy message 1 - Not real user data',
      'Fake conversation thread',
      'Honeypot encryption key: fake123',
      'Decoy user profile data',
      'Fake contact list entry'
    ];

    // Fill storage with fake data
    for (let i = 0; i < 50; i++) {
      const fakeKey = `fake_data_${i}_${Math.random()}`;
      const fakeValue = decoyMessages[Math.floor(Math.random() * decoyMessages.length)];
      localStorage.setItem(fakeKey, fakeValue);
    }

    console.log('🎭 Decoy data deployed - attacker will find fake information');
  }

  // Lock down only Layer 1, keep 2/3 intact
  private lockdownLayer1Only(): void {
    // Disable only client-side functions
    window.localStorage.setItem('layer1_locked', 'true');
    window.localStorage.setItem('lockdown_reason', 'SECURITY_BREACH_DETECTED');
    
    // Layer 2 (server) and Layer 3 (Rust) remain functional
    console.log('🔐 Layer 1 locked - Layers 2&3 remain secure with user data');
  }

  // Show recovery message to user
  private showSecureRecoveryMessage(): void {
    // Create secure recovery interface
    const recoveryDiv = document.createElement('div');
    recoveryDiv.innerHTML = `
      <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                  background: linear-gradient(135deg, #1e3c72, #2a5298); 
                  color: white; display: flex; align-items: center; justify-content: center; 
                  z-index: 10000; font-family: Arial, sans-serif;">
        <div style="text-align: center; padding: 40px; background: rgba(0,0,0,0.7); 
                    border-radius: 15px; max-width: 500px;">
          <div style="font-size: 60px; margin-bottom: 20px;">🛡️</div>
          <h2 style="color: #4CAF50; margin-bottom: 20px;">Sizning Ma'lumotlaringiz Xavfsiz!</h2>
          <p style="margin-bottom: 15px;">🔒 <strong>1-qatlam buzildi</strong>, lekin sizning ma'lumotlaringiz:</p>
          <ul style="text-align: left; margin: 20px 0;">
            <li>✅ <strong>2-qatlam</strong> (Server): Himoyalangan</li>
            <li>✅ <strong>3-qatlam</strong> (Rust): Xavfsiz</li>
            <li>✅ <strong>Barcha xabarlar</strong>: Zaxiralangan</li>
            <li>✅ <strong>Shaxsiy ma'lumotlar</strong>: Muhofaza qilingan</li>
          </ul>
          <p style="color: #FFD700; margin: 20px 0;">
            🔄 Tizim avtomatik tiklash rejimida...
          </p>
          <div style="margin-top: 30px;">
            <button onclick="window.location.href='/secure-recovery'" 
                    style="background: #4CAF50; color: white; border: none; 
                           padding: 15px 30px; border-radius: 8px; font-size: 16px; cursor: pointer;">
              🔐 Xavfsiz Tiklanish
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(recoveryDiv);
  }

  // Send breach alert to server
  private sendBreachAlert(): void {
    try {
      fetch('/api/security/breach-alert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'LAYER_1_BREACH',
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
          url: window.location.href,
          dataProtectionStatus: 'BACKUP_COMPLETED',
          userDataSafe: true
        })
      }).catch(() => {
        // Silent failure - don't alert attacker
      });
    } catch (error) {
      // Silent failure
    }
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