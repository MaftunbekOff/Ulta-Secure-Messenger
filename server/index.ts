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

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
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