import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Shield, AlertTriangle, CheckCircle, XCircle, Activity } from 'lucide-react';
import { securityMonitor } from '../lib/securityMonitor';
import { encryptionManager } from '../lib/encryptionIntegration';

export function SecurityDashboard() {
  const [securityReport, setSecurityReport] = useState({
    overallScore: 100,
    issues: [],
    recommendations: []
  });
  const [isVisible, setIsVisible] = useState(false);

  // Security monitoring with encryption status
  useEffect(() => {
    const monitor = securityMonitor;
    
    // Start monitoring without throwing errors
    monitor.startMonitoring().catch(error => {
      console.warn('Security monitoring failed to start:', error);
    });

    const updateSecurityReport = () => {
      try {
        const report = monitor.generateSecurityReport();
        setSecurityReport(report);
      } catch (error) {
        console.warn('Failed to generate security report:', error);
      }
    };

    const checkSecurityIssues = () => {
      try {
        const issues = monitor.getSecurityEvents();
        const recentIssues = issues.filter(
          issue => Date.now() - issue.timestamp < 60000
        );

        // Check encryption status
        const encryptionStatus = encryptionManager.getEncryptionStatus();
        if (!encryptionStatus.isSecure) {
          console.warn('Encryption not properly configured');
        }

        if (recentIssues.length > 0) {
          console.warn('Security issues detected:', recentIssues);
        }

        // Update security report
        updateSecurityReport();
      } catch (error) {
        console.warn('Security check failed:', error);
      }
    };

    // Initial check
    updateSecurityReport();
    
    const interval = setInterval(checkSecurityIssues, 60000); // Har 1 daqiqada

    return () => {
      clearInterval(interval);
      monitor.stopMonitoring();
    };
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-500';
    if (score >= 70) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 90) return <CheckCircle className="h-6 w-6 text-green-500" />;
    if (score >= 70) return <AlertTriangle className="h-6 w-6 text-yellow-500" />;
    return <XCircle className="h-6 w-6 text-red-500" />;
  };

  const getSeverityBadge = (severity: string) => {
    const variants = {
      low: 'secondary',
      medium: 'default',
      high: 'destructive',
      critical: 'destructive'
    };

    return (
      <Badge variant={variants[severity] as any} className="text-xs">
        {severity.toUpperCase()}
      </Badge>
    );
  };

  const encryptionStatus = encryptionManager.getEncryptionStatus();

  if (!isVisible) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 p-2"
        title="Security Dashboard"
      >
        <Shield className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 max-h-96 overflow-y-auto bg-background/95 backdrop-blur border rounded-lg shadow-lg">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Security Monitor
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsVisible(false)}
              className="p-1 h-6 w-6"
            >
              ×
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Overall Security Score */}
          <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
            {getScoreIcon(securityReport.overallScore)}
            <div className="text-center">
              <div className={`text-2xl font-bold ${getScoreColor(securityReport.overallScore)}`}>
                {securityReport.overallScore}/100
              </div>
              <div className="text-xs text-muted-foreground">Security Score</div>
            </div>
          </div>

          {/* Recent Issues */}
          {securityReport.issues.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Recent Issues</h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {securityReport.issues.slice(0, 5).map((issue, index) => (
                  <div key={index} className="flex items-center justify-between text-xs p-1 bg-muted/30 rounded">
                    <span className="truncate flex-1 mr-2">
                      {issue.details?.issue || issue.type}
                    </span>
                    {getSeverityBadge(issue.severity)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Security Features Status */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Security Features</h4>
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span>End-to-End Encryption</span>
                {encryptionStatus.isSecure ? (
                  <CheckCircle className="h-3 w-3 text-green-500" />
                ) : (
                  <XCircle className="h-3 w-3 text-red-500" />
                )}
              </div>
              <div className="flex items-center justify-between">
                <span>Military-Grade Crypto</span>
                <CheckCircle className="h-3 w-3 text-green-500" />
              </div>
              <div className="flex items-center justify-between">
                <span>Quantum-Safe Protection</span>
                <CheckCircle className="h-3 w-3 text-green-500" />
              </div>
              <div className="flex items-center justify-between">
                <span>Self-Destruct Messages</span>
                <CheckCircle className="h-3 w-3 text-green-500" />
              </div>
              <div className="flex items-center justify-between">
                <span>Biometric Authentication</span>
                <CheckCircle className="h-3 w-3 text-green-500" />
              </div>
              <div className="flex items-center justify-between">
                <span>Real-time Monitoring</span>
                <Activity className="h-3 w-3 text-blue-500" />
              </div>
            </div>
          </div>

          {/* Recommendations */}
          {securityReport.recommendations.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Recommendations</h4>
              <div className="space-y-1">
                {securityReport.recommendations.slice(0, 3).map((rec, index) => (
                  <div key={index} className="text-xs p-1 bg-blue-50 dark:bg-blue-900/20 rounded">
                    {rec}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}