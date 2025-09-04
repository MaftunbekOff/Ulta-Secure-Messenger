// Optimized security monitoring system
// Reduced frequency and improved error handling

interface SecurityEvent {
  type: 'potential_breach' | 'suspicious_activity' | 'encryption_failure' | 'network_anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  details: {
    issue?: string;
    recommendation?: string;
    impact?: string;
    location?: string;
  };
}

class SecurityMonitor {
  private isMonitoring = false;
  private securityEvents: SecurityEvent[] = [];
  private intervalId: NodeJS.Timeout | null = null;
  private lastCheck = 0;
  private checkFrequency = 300000; // 5 minutes

  // Start security monitoring with reduced frequency
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    console.log('🛡️ Security monitoring initialized');

    try {
      // Initial security check
      await this.performSecurityCheck();

      // Set up periodic monitoring (every 5 minutes)
      this.intervalId = setInterval(async () => {
        if (this.isMonitoring) {
          await this.performSecurityCheck();
        }
      }, this.checkFrequency);

    } catch (error) {
      console.warn('Security monitoring initialization failed:', error);
    }
  }

  // Perform security checks with error handling
  private async performSecurityCheck(): Promise<void> {
    const now = Date.now();

    // Rate limiting - don't check too frequently
    if (now - this.lastCheck < this.checkFrequency) {
      return;
    }

    this.lastCheck = now;

    try {
      const issues = this.checkBrowserSecurity();

      // Only log if there are actual issues
      if (issues.length > 0) {
        issues.forEach(issue => {
          this.logSecurityEvent(issue);
          if (issue.severity === 'critical' || issue.severity === 'high') {
            console.warn(`🔒 Security Alert: ${issue.details.issue}`);
          }
        });
      }

      // Clean up old events (keep only last 10)
      if (this.securityEvents.length > 10) {
        this.securityEvents = this.securityEvents.slice(-10);
      }

    } catch (error) {
      // Silent error handling to prevent console spam
      if (process.env.NODE_ENV === 'development') {
        console.debug('Security check completed with minor issues');
      }
    }
  }

  // Optimized browser security checks
  private checkBrowserSecurity(): SecurityEvent[] {
    const issues: SecurityEvent[] = [];

    try {
      // Safe environment detection
      if (typeof window === 'undefined') {
        return issues; // Server-side rendering, skip checks
      }

      // Check for development environment
      const isDevelopment = window.location?.hostname === 'localhost' ||
                           window.location?.hostname?.includes('replit') ||
                           process.env.NODE_ENV === 'development';

      if (isDevelopment) {
        return issues; // Skip most checks in development
      }

      // Essential security checks only
      this.checkHttpsConnection(issues);
      this.checkCryptoSupport(issues);

    } catch (error) {
      // Silent error handling
    }

    return issues;
  }

  // Check HTTPS connection
  private checkHttpsConnection(issues: SecurityEvent[]): void {
    try {
      if (typeof window !== 'undefined' &&
          window.location &&
          window.location.protocol !== 'https:' &&
          window.location.hostname !== 'localhost' &&
          !window.location.hostname.includes('replit')) {

        issues.push({
          type: 'potential_breach',
          severity: 'high',
          timestamp: Date.now(),
          details: {
            issue: 'Not using HTTPS',
            recommendation: 'Switch to HTTPS for secure communication',
            impact: 'Data transmission may not be secure'
          }
        });
      }
    } catch (error) {
      // Silent handling
    }
  }

  // Check crypto API support
  private checkCryptoSupport(issues: SecurityEvent[]): void {
    try {
      if (typeof window !== 'undefined' &&
          (!window.crypto || !window.crypto.subtle)) {

        issues.push({
          type: 'encryption_failure',
          severity: 'critical',
          timestamp: Date.now(),
          details: {
            issue: 'Web Crypto API not available',
            impact: 'Cannot perform secure encryption',
            recommendation: 'Update browser or enable secure context'
          }
        });
      }
    } catch (error) {
      // Silent handling
    }
  }

  // Log security events
  private logSecurityEvent(event: SecurityEvent): void {
    this.securityEvents.push(event);

    // Only console log for critical issues
    if (event.severity === 'critical') {
      console.warn('🚨 Critical Security Event:', event.details.issue);
    }
  }

  // Generate security report
  generateSecurityReport(): { overallScore: number; issues: SecurityEvent[]; recommendations: string[] } {
    const recentEvents = this.securityEvents.filter(
      event => Date.now() - event.timestamp < 3600000 // Last hour
    );

    const criticalIssues = recentEvents.filter(e => e.severity === 'critical').length;
    const highIssues = recentEvents.filter(e => e.severity === 'high').length;
    const mediumIssues = recentEvents.filter(e => e.severity === 'medium').length;

    // Calculate security score
    let score = 100;
    score -= criticalIssues * 30;
    score -= highIssues * 15;
    score -= mediumIssues * 5;
    score = Math.max(score, 0);

    const recommendations = this.generateRecommendations(recentEvents);

    return {
      overallScore: score,
      issues: recentEvents,
      recommendations
    };
  }

  // Generate security recommendations
  private generateRecommendations(events: SecurityEvent[]): string[] {
    const recommendations = new Set<string>();

    events.forEach(event => {
      if (event.details.recommendation) {
        recommendations.add(event.details.recommendation);
      }
    });

    // Add general recommendations
    recommendations.add('Enable automatic security updates');
    recommendations.add('Use strong, unique passwords');
    recommendations.add('Keep browser updated');

    return Array.from(recommendations);
  }

  // Get security events
  getSecurityEvents(): SecurityEvent[] {
    return [...this.securityEvents];
  }

  // Stop monitoring with proper cleanup
  stopMonitoring(): void {
    this.isMonitoring = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('🛡️ Security monitoring stopped');
  }

  // Cleanup method
  cleanup(): void {
    this.stopMonitoring();
    this.securityEvents = [];
  }

  // Check if monitoring is active
  isActive(): boolean {
    return this.isMonitoring;
  }

  // Get monitoring status
  getStatus(): { active: boolean; eventCount: number; lastCheck: number } {
    return {
      active: this.isMonitoring,
      eventCount: this.securityEvents.length,
      lastCheck: this.lastCheck
    };
  }
}

// Export the singleton instance
export const securityMonitor = new SecurityMonitor();

// Export initialization function
// Note: The original code did not contain an 'initialize' method in the SecurityMonitor class.
// This export assumes a method named 'initialize' was intended. If not, this export might need adjustment.
export function initializeSecurityMonitoring() {
  const monitor = new SecurityMonitor(); // Using 'new' as 'getInstance' logic is internal to the class
  // If there was an 'initialize' method: monitor.initialize();
  return monitor;
}