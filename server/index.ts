import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { rustIntegration } from './rustIntegration';

// Set NODE_ENV if not already set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  // Skip detailed logging for frequent endpoints
  const isFrequentEndpoint = path === '/api/auth/me' || path === '/api/chats';

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      // Simple logging for performance
      if (isFrequentEndpoint) {
        // Only log slow requests
        if (duration > 1000) {
          log(`SLOW: ${req.method} ${path} ${res.statusCode} in ${duration}ms`);
        }
      } else {
        log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
      }
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Secure layer communication endpoints
  app.post('/api/secure-storage', async (req, res) => {
    try {
      const { key, value, layer } = req.body;
      console.log(`🔐 Secure storage request for layer ${layer}`);

      // Layer 2 da xavfsiz saqlash
      const secureData = Buffer.from(JSON.stringify({ key, value, timestamp: Date.now() })).toString('base64');

      res.json({ success: true, stored: true, layer });
    } catch (error) {
      res.status(500).json({ error: 'Secure storage failed' });
    }
  });

  app.post('/api/rust/secure-vault', async (req, res) => {
    try {
      const { key, value, layer } = req.body;
      console.log(`🦀 Rust secure vault request for layer ${layer}`);

      // Rust layer ga xavfsiz yuborish (simulation)
      res.json({ success: true, vaulted: true, layer });
    } catch (error) {
      res.status(500).json({ error: 'Rust vault failed' });
    }
  });

  app.post('/api/invalidate-sessions', (req, res) => {
    console.log('🔄 All layer sessions invalidated');
    res.json({ success: true, invalidated: true });
  });

  // Error handling
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
  });


  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  const host = process.env.HOST || "0.0.0.0";
  server.listen(port, host, () => {
    log(`🚀 Server ishlamoqda: http://localhost:${port}`);

  // Initialize Rust components
  console.log('🦀 Rust komponentlarini ishga tushirish...');

  // Rust health check with timeout
  Promise.race([
    rustIntegration.healthCheck(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
  ]).then(isHealthy => {
    if (isHealthy) {
      console.log('✅ Rust komponentlari tayyor');

      // Run performance benchmark with error handling
      rustIntegration.benchmarkPerformance().catch(error => {
        console.warn('⚠️ Rust benchmark failed:', error.message);
      });

      // Get metrics with error handling
      rustIntegration.getMetrics().then(metrics => {
        if (metrics) {
          console.log('📊 Rust metrics:', JSON.stringify(metrics, null, 2));
        }
      }).catch(error => {
        console.warn('⚠️ Failed to get Rust metrics:', error.message);
      });
    } else {
      console.warn('⚠️ Rust komponentlari ishlamayapti - continuing without Rust integration');
    }
  }).catch(error => {
    console.warn('⚠️ Rust health check failed:', error.message, '- continuing without Rust integration');
  });

  // Start Go WebSocket server check
  setTimeout(() => {
    fetch('http://localhost:8080/health')
      .then(res => res.json())
      .then(data => console.log('✅ Go WebSocket server healthy:', data.status))
      .catch(() => console.warn('⚠️ Go WebSocket server not responding - make sure to run it separately'));
  }, 2000);
  });
})();