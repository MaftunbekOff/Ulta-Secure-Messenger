// Optimized real-time security monitoring
// Lightweight attack and threat detection system

interface SecurityEvent {
  type: 'login_attempt' | 'encryption_failure' | 'unusual_activity' | 'potential_breach';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  details: any;
  location?: string;
  userId?: string;
}

export class SecurityMonitor {
  private static instance: SecurityMonitor;
  private events: SecurityEvent[] = [];
  private alertCallbacks: ((event: SecurityEvent) => void)[] = [];
  private anomalyCodes: Set<string> = new Set();
  private isMonitoring: boolean = false; // Monitoring holatini kuzatish uchun flag

  static getInstance(): SecurityMonitor {
    if (!SecurityMonitor.instance) {
      SecurityMonitor.instance = new SecurityMonitor();
    }
    return SecurityMonitor.instance;
  }

  // Xavfsizlik hodisasini ro'yxatga olish
  logSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
    // Rate limiting - bir xil event turidan 1 minutda faqat 3 ta
    const now = Date.now();
    const recentSimilarEvents = this.events.filter(e => 
      e.type === event.type && 
      e.severity === event.severity && 
      now - e.timestamp < 60000
    );
    
    if (recentSimilarEvents.length >= 3) {
      return; // Skip logging to prevent spam
    }

    const fullEvent: SecurityEvent = {
      ...event,
      timestamp: now
    };

    this.events.push(fullEvent);

    // Faqat oxirgi 500 ta hodisani saqlash (memory optimization)
    if (this.events.length > 500) {
      this.events = this.events.slice(-500);
    }

    // Jiddiy hodisalar uchun darhol ogohlantirish
    if (fullEvent.severity === 'high' || fullEvent.severity === 'critical') {
      this.triggerAlerts(fullEvent);
    }

    // Xavfli faoliyatni aniqlash
    this.detectAnomalies(fullEvent);

    // Faqat development da log qilish
    if (process.env.NODE_ENV === 'development' && fullEvent.severity === 'critical') {
      console.log(`🚨 Critical security event:`, fullEvent);
    }
  }

  // Ogohlantirish callback'ini ro'yxatga olish
  onSecurityAlert(callback: (event: SecurityEvent) => void): void {
    this.alertCallbacks.push(callback);
  }

  // Ogohlantirishlarni ishga tushirish
  private triggerAlerts(event: SecurityEvent): void {
    this.alertCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Security alert callback failed:', error);
      }
    });
  }

  // Anomaliyalarni aniqlash
  private detectAnomalies(event: SecurityEvent): void {
    const recentEvents = this.events.filter(e => 
      Date.now() - e.timestamp < 5 * 60 * 1000 // Oxirgi 5 daqiqa
    );

    // Ko'p marta muvaffaqiyatsiz login urinishlar
    if (event.type === 'login_attempt') {
      const failedAttempts = recentEvents.filter(e => 
        e.type === 'login_attempt' && e.details?.success === false
      );

      if (failedAttempts.length >= 5) {
        this.logSecurityEvent({
          type: 'potential_breach',
          severity: 'high',
          details: {
            reason: 'Multiple failed login attempts',
            count: failedAttempts.length,
            timeWindow: '5 minutes'
          }
        });
      }
    }

    // Shifrlash xatoliklari
    if (event.type === 'encryption_failure') {
      const encryptionFailures = recentEvents.filter(e => 
        e.type === 'encryption_failure'
      );

      if (encryptionFailures.length >= 3) {
        this.logSecurityEvent({
          type: 'potential_breach',
          severity: 'critical',
          details: {
            reason: 'Multiple encryption failures - possible attack',
            count: encryptionFailures.length
          }
        });
      }
    }
  }

  // Browser xavfsizligini tekshirish - optimizatsiya qilingan
  checkBrowserSecurity(): SecurityEvent[] {
    const issues: SecurityEvent[] = [];

    try {
      // Safer environment detection
      const isProduction = typeof window !== 'undefined' && 
                          (window.location.hostname.includes('replit') || 
                           process.env.NODE_ENV === 'production');
      
      // Faqat production muhitida va kam chastotada tekshirish
      if (!isProduction || Math.random() > 0.1) { // 10% chance to run
        return issues; 
      }

      // HTTPS tekshirish (faqat production da)
      if (typeof window !== 'undefined' && window.location && 
          window.location.protocol !== 'https:' && 
          window.location.hostname !== 'localhost' && 
          !window.location.hostname.includes('replit')) {
        issues.push({
          type: 'potential_breach',
          severity: 'high',
          timestamp: Date.now(),
          details: {
            issue: 'Not using HTTPS',
            recommendation: 'Switch to HTTPS for secure communication'
          }
        });
      }

      // Crypto API mavjudligini tekshirish
      if (typeof window !== 'undefined' && (!window.crypto || !window.crypto.subtle)) {
        issues.push({
          type: 'encryption_failure',
          severity: 'critical',
          timestamp: Date.now(),
          details: {
            issue: 'Web Crypto API not available',
            impact: 'Cannot perform secure encryption'
          }
        });
      }
    } catch (error) {
      // Faqat muhim xatolarni log qilish
      if (process.env.NODE_ENV === 'development') {
        console.debug('Security check minor issue:', error?.message || 'Unknown');
      }
    }

    return issues;
  }

  // Developer tools ochiqligini aniqlash
  private isDevToolsOpen(): boolean {
    const threshold = 160;
    return (
      window.outerHeight - window.innerHeight > threshold ||
      window.outerWidth - window.innerWidth > threshold
    );
  }

  // Xotira xavfsizligini tekshirish
  async checkMemorySecurity(): Promise<void> {
    try {
      // LocalStorage'dagi sensitiv ma'lumotlarni tekshirish
      const sensitiveKeys = ['privateKey', 'militaryPrivateKey', 'password'];
      const foundSensitiveData: string[] = [];

      sensitiveKeys.forEach(key => {
        if (localStorage.getItem(key)) {
          foundSensitiveData.push(key);
        }
      });

      if (foundSensitiveData.length > 0) {
        // Simulating an async operation
        await new Promise(resolve => setTimeout(resolve, 50)); 
        this.logSecurityEvent({
          type: 'potential_breach',
          severity: 'medium',
          details: {
            issue: 'Sensitive data in localStorage',
            keys: foundSensitiveData,
            recommendation: 'Move to secure storage or encrypt'
          }
        });
      }
    } catch (error) {
      // Silent error handling
      console.warn('Memory security check failed:', error);
    }
  }

  // Tarmoq xavfsizligini monitoring qilish
  monitorNetworkSecurity(): void {
    // WebSocket ulanishini kuzatish
    const originalWebSocket = window.WebSocket;
    window.WebSocket = class extends WebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);

        this.addEventListener('error', (event) => {
          // Ensure the event is handled correctly and no unhandled promise rejection occurs
          try {
            SecurityMonitor.getInstance().logSecurityEvent({
              type: 'potential_breach',
              severity: 'high',
              details: {
                issue: 'WebSocket connection failed',
                url: url.toString(),
                suspiciousActivity: true,
                originalError: event
              }
            });
          } catch (err) {
            console.warn('Error logging WebSocket event:', err);
          }
        });
      }
    };

    // Fetch so'rovlarini kuzatish
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);

        if (!response.ok && response.status === 401) {
          this.logSecurityEvent({
            type: 'login_attempt',
            severity: 'medium',
            details: {
              success: false,
              url: args[0].toString(),
              status: response.status
            }
          });
        }

        return response;
      } catch (error) {
        // Handle fetch errors to prevent unhandled promise rejections
        SecurityMonitor.getInstance().logSecurityEvent({
          type: 'potential_breach',
          severity: 'critical',
          details: {
            issue: 'Fetch request failed',
            url: args[0].toString(),
            error: error
          }
        });
        throw error; // Re-throw the error to maintain original fetch behavior if needed
      }
    };
  }

  // Xavfsizlik hisobotini yaratish
  generateSecurityReport(): {
    overallScore: number;
    issues: SecurityEvent[];
    recommendations: string[];
  } {
    const recentIssues = this.events.filter(e => 
      Date.now() - e.timestamp < 24 * 60 * 60 * 1000 // Oxirgi 24 soat
    );

    const criticalCount = recentIssues.filter(e => e.severity === 'critical').length;
    const highCount = recentIssues.filter(e => e.severity === 'high').length;
    const mediumCount = recentIssues.filter(e => e.severity === 'medium').length;

    // Xavfsizlik hisobini hisoblash (0-100)
    let score = 100;
    score -= criticalCount * 30;
    score -= highCount * 15;
    score -= mediumCount * 5;
    score = Math.max(0, score);

    const recommendations = this.generateRecommendations(recentIssues);

    return {
      overallScore: score,
      issues: recentIssues,
      recommendations
    };
  }

  // Tavsiyalar yaratish
  private generateRecommendations(issues: SecurityEvent[]): string[] {
    const recommendations: string[] = [];

    if (issues.some(e => e.type === 'login_attempt' && e.details?.success === false)) {
      recommendations.push('Enable two-factor authentication');
      recommendations.push('Consider implementing account lockout policies');
    }

    if (issues.some(e => e.type === 'encryption_failure')) {
      recommendations.push('Review encryption implementation');
      recommendations.push('Update to latest cryptographic standards');
    }

    if (issues.some(e => e.details?.issue === 'Not using HTTPS')) {
      recommendations.push('Migrate to HTTPS immediately');
    }

    if (issues.some(e => e.details?.issue === 'Developer tools detected')) {
      recommendations.push('Implement anti-debugging measures');
      recommendations.push('Add tamper detection');
    }

    return recommendations;
  }

  // Monitoring jarayonini boshlash
  async startMonitoring(): Promise<void> {
    try {
      this.isMonitoring = true;

      // Browser xavfsizligini tekshirish
      const browserIssues = this.checkBrowserSecurity();
      browserIssues.forEach(issue => this.logSecurityEvent(issue));

      // Xotira xavfsizligini tekshirish
      await this.checkMemorySecurity();

      // Tarmoq monitoringini boshlash
      this.monitorNetworkSecurity();

      // Har 5 daqiqada tekshirish (spam ni kamaytirish uchun)
      setInterval(async () => {
        if (this.isMonitoring) {
          try {
            const issues = this.checkBrowserSecurity();
            issues.forEach(issue => this.logSecurityEvent(issue));
            await this.checkMemorySecurity();
          } catch (error) {
            // Silent error handling - no console spam
            if (process.env.NODE_ENV === 'development') {
              console.debug('Security check minor issue:', error?.message || 'Unknown');
            }
          }
        }
      }, 300000); // 5 minutes instead of 30 seconds
    } catch (error) {
      console.error('Security monitoring start failed:', error);
      throw error;
    }
  }

  // Tozalash
  cleanup(): void {
    this.isMonitoring = false; // Monitoringni to'xtatish
    this.events = [];
    this.alertCallbacks = [];
    this.anomalyCodes.clear();
    // Potentially clear intervals here if needed for full cleanup
  }
}

export const securityMonitor = SecurityMonitor.getInstance();

// Xavfsizlik monitoring tizimi
export const initializeSecurityMonitoring = async (): Promise<void> => {
  try {
    await securityMonitor.startMonitoring();
  } catch (error) {
    console.warn('Security monitoring initialization failed:', error);
  }
};

// Enhanced error handling with throttling
if (typeof window !== 'undefined') {
  let errorCount = 0;
  const errorLimit = 5; // Reduced limit
  const resetInterval = 300000; // 5 minutes instead of 1 minute
  
  setInterval(() => { errorCount = 0; }, resetInterval);
  
  // Better global error monitoring with reduced sensitivity
  window.addEventListener('unhandledrejection', (event) => {
    if (errorCount >= errorLimit) {
      event.preventDefault();
      return;
    }
    
    const reason = event.reason?.message || event.reason || '';
    
    // Only log critical errors
    if (reason.includes('CRITICAL') || reason.includes('SECURITY BREACH')) {
      errorCount++;
      try {
        securityMonitor.logSecurityEvent({
          type: 'unusual_activity',
          severity: 'high',
          details: {
            message: 'Critical application error',
            reason: reason.substring(0, 80),
            count: errorCount
          }
        });
      } catch {
        // Silent failure
      }
    }
    event.preventDefault();
  });
  
  // Simplified error recovery
  window.addEventListener('error', (event) => {
    if (errorCount >= errorLimit) return;
    
    // Only react to critical errors
    if (event.message?.includes('Network Error') && errorCount < 2) {
      errorCount++;
      if (process.env.NODE_ENV === 'development') {
        console.debug('Network error detected, monitoring...');
      }
    }
  });
}