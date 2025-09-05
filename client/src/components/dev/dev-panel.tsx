import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings, 
  Terminal, 
  Eye, 
  EyeOff, 
  Copy, 
  Trash2, 
  Activity,
  Shield,
  Clock,
  Wifi,
  Database
} from 'lucide-react';

// Global debug state
declare global {
  interface Window {
    __ULTRA_DEBUG__: {
      logging: boolean;
      originalConsoleLog: typeof console.log;
      logs: Array<{
        timestamp: Date;
        level: string;
        message: string;
        data?: any;
      }>;
    };
  }
}

interface DevPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentMessages?: Array<{
    id: string;
    content: string;
    encrypted?: boolean;
    originalContent?: string;
    encryptedContent?: string;
  }>;
  connectionStatus?: string;
  isConnected?: boolean;
}

export function DevPanel({ 
  isOpen, 
  onClose, 
  currentMessages = [], 
  connectionStatus = 'disconnected',
  isConnected = false 
}: DevPanelProps) {
  const [debugLogging, setDebugLogging] = useState(false);
  const [logs, setLogs] = useState<Array<{
    timestamp: Date;
    level: string;
    message: string;
    data?: any;
  }>>([]);
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);

  // Initialize debug system
  useEffect(() => {
    if (!window.__ULTRA_DEBUG__) {
      window.__ULTRA_DEBUG__ = {
        logging: false,
        originalConsoleLog: console.log,
        logs: []
      };
    }
  }, []);

  // Toggle debug logging
  const toggleDebugLogging = (enabled: boolean) => {
    setDebugLogging(enabled);
    window.__ULTRA_DEBUG__.logging = enabled;

    if (enabled) {
      // Override console.log to capture logs
      console.log = (...args: any[]) => {
        const logEntry = {
          timestamp: new Date(),
          level: 'LOG',
          message: args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' ')
        };
        
        window.__ULTRA_DEBUG__.logs.push(logEntry);
        setLogs(prev => [...prev, logEntry].slice(-100)); // Keep last 100 logs
        
        // Still call original console.log
        window.__ULTRA_DEBUG__.originalConsoleLog(...args);
      };

      // Also capture console.error, console.warn
      const originalError = console.error;
      const originalWarn = console.warn;

      console.error = (...args: any[]) => {
        const logEntry = {
          timestamp: new Date(),
          level: 'ERROR',
          message: args.map(arg => String(arg)).join(' ')
        };
        window.__ULTRA_DEBUG__.logs.push(logEntry);
        setLogs(prev => [...prev, logEntry].slice(-100));
        originalError(...args);
      };

      console.warn = (...args: any[]) => {
        const logEntry = {
          timestamp: new Date(),
          level: 'WARN',
          message: args.map(arg => String(arg)).join(' ')
        };
        window.__ULTRA_DEBUG__.logs.push(logEntry);
        setLogs(prev => [...prev, logEntry].slice(-100));
        originalWarn(...args);
      };

    } else {
      // Restore original console.log
      console.log = window.__ULTRA_DEBUG__.originalConsoleLog;
    }
  };

  const clearLogs = () => {
    setLogs([]);
    window.__ULTRA_DEBUG__.logs = [];
  };

  const copyLogs = () => {
    const logText = logs.map(log => 
      `[${log.timestamp.toLocaleTimeString()}] ${log.level}: ${log.message}`
    ).join('\n');
    navigator.clipboard.writeText(logText);
  };

  const getMessageDisplay = (message: any) => {
    if (message.encrypted && message.encryptedContent) {
      return {
        original: message.originalContent || message.content,
        encrypted: message.encryptedContent,
        isEncrypted: true
      };
    }
    return {
      original: message.content,
      encrypted: 'Not encrypted',
      isEncrypted: false
    };
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl h-[80vh] flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              UltraSecure Dev Panel
              <Badge variant="outline">Development Mode</Badge>
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              ✕
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden">
          <Tabs defaultValue="console" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="console" className="flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                Console
              </TabsTrigger>
              <TabsTrigger value="messages" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Messages
              </TabsTrigger>
              <TabsTrigger value="system" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                System
              </TabsTrigger>
              <TabsTrigger value="network" className="flex items-center gap-2">
                <Wifi className="h-4 w-4" />
                Network
              </TabsTrigger>
            </TabsList>

            {/* Console Tab */}
            <TabsContent value="console" className="flex-1 flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch 
                    checked={debugLogging} 
                    onCheckedChange={toggleDebugLogging}
                  />
                  <span>Debug Logging</span>
                  <Badge variant={debugLogging ? "default" : "secondary"}>
                    {debugLogging ? "ON" : "OFF"}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={copyLogs}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                  <Button size="sm" variant="outline" onClick={clearLogs}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                </div>
              </div>

              <div className="flex-1 border rounded-lg p-4 bg-slate-950 text-green-400 font-mono text-sm overflow-auto">
                {logs.length === 0 ? (
                  <div className="text-slate-500">No logs yet. Enable debug logging to see console output.</div>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="mb-1">
                      <span className="text-slate-400">
                        [{log.timestamp.toLocaleTimeString()}]
                      </span>
                      <span className={`ml-2 ${
                        log.level === 'ERROR' ? 'text-red-400' : 
                        log.level === 'WARN' ? 'text-yellow-400' : 
                        'text-green-400'
                      }`}>
                        {log.level}:
                      </span>
                      <span className="ml-2">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            {/* Messages Tab */}
            <TabsContent value="messages" className="flex-1 flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Message Encryption Viewer</h3>
                <Badge>{currentMessages.length} messages</Badge>
              </div>

              <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Messages List</h4>
                  <div className="border rounded-lg p-2 h-64 overflow-auto">
                    {currentMessages.map((message) => {
                      const display = getMessageDisplay(message);
                      return (
                        <div 
                          key={message.id} 
                          className={`p-2 rounded cursor-pointer hover:bg-muted ${
                            selectedMessage === message.id ? 'bg-primary/10' : ''
                          }`}
                          onClick={() => setSelectedMessage(message.id)}
                        >
                          <div className="flex items-center gap-2">
                            {display.isEncrypted ? (
                              <Eye className="h-4 w-4 text-green-500" />
                            ) : (
                              <EyeOff className="h-4 w-4 text-gray-500" />
                            )}
                            <span className="text-sm truncate">
                              {display.original.substring(0, 30)}...
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Message Details</h4>
                  {selectedMessage ? (
                    (() => {
                      const message = currentMessages.find(m => m.id === selectedMessage);
                      if (!message) return <div>Message not found</div>;
                      const display = getMessageDisplay(message);
                      
                      return (
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium">Original Content:</label>
                            <Textarea 
                              value={display.original} 
                              readOnly 
                              className="mt-1"
                              rows={3}
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium">Encrypted Content:</label>
                            <Textarea 
                              value={display.encrypted} 
                              readOnly 
                              className="mt-1 font-mono text-xs"
                              rows={4}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={display.isEncrypted ? "default" : "secondary"}>
                              {display.isEncrypted ? "Encrypted" : "Plain Text"}
                            </Badge>
                            {display.isEncrypted && (
                              <Badge variant="outline">AES-256-GCM</Badge>
                            )}
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="text-slate-500 text-center py-8">
                      Select a message to view encryption details
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* System Tab */}
            <TabsContent value="system" className="flex-1 space-y-4">
              <h3 className="text-lg font-semibold">System Information</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Performance
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div>Memory: {(performance as any).memory ? 
                        `${Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024)}MB` : 
                        'Not available'
                      }</div>
                      <div>Timing: {Math.round(performance.now())}ms</div>
                      <div>Logs: {logs.length}/100</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Environment
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div>Mode: Development</div>
                      <div>Platform: {navigator.platform}</div>
                      <div>User Agent: {navigator.userAgent.substring(0, 20)}...</div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Network Tab */}
            <TabsContent value="network" className="flex-1 space-y-4">
              <h3 className="text-lg font-semibold">Network & WebSocket Status</h3>
              
              <div className="grid grid-cols-1 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">WebSocket Connection</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={isConnected ? "default" : "destructive"}>
                          {isConnected ? "Connected" : "Disconnected"}
                        </Badge>
                        <span className="text-sm">Status: {connectionStatus}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Last update: {new Date().toLocaleTimeString()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export default DevPanel;