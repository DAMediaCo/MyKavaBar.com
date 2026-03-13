import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import * as path from "path";
import { Server, createServer } from "http";
import { setupWebSocket } from "./websocket";
import { randomInt } from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = parseInt(process.env.PORT || "5000", 10); // Use environment port or default to 5000
const HOST = "0.0.0.0";

// Enhanced logging middleware
const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      query: req.query,
      timestamp: new Date().toISOString(),
      headers: {
        cookie: req.headers.cookie,
        origin: req.headers.origin,
        "user-agent": req.headers["user-agent"],
      },
    };

    if (req.path.startsWith("/api")) {
      log(`API Request: ${JSON.stringify(logData, null, 2)}`);
    }
  });
  next();
};

// Basic middleware setup with increased limits
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: false, limit: "25mb" }));
app.disable("x-powered-by");

// Enhanced CORS configuration for development
app.use((req, res, next) => {
  const origin = req.headers.origin;

  const allowedOrigins = [
    "https://*.repl.co", "https://*.replit.dev",
    "https://mykavabar.com", "https://www.mykavabar.com",
    "https://mykavabar-ios-api.fly.dev",
    "capacitor://localhost", "ionic://localhost",
    "http://localhost", "http://localhost:3000", "http://localhost:8100",
  ];
  if (!origin) {
    res.header("Access-Control-Allow-Origin", "*");
  } else if (process.env.NODE_ENV === "development") {
    res.header("Access-Control-Allow-Origin", origin);
  } else {
    const isAllowed = allowedOrigins.some((p) =>
      origin.match(new RegExp("^" + p.replace(/\*/g, ".*") + "$")),
    );
    res.header("Access-Control-Allow-Origin", isAllowed ? origin : "https://mykavabar.com");
  }

  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Cookie",
  );
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Expose-Headers", "Set-Cookie");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

// Add the enhanced request logger
app.use(requestLogger);

// Production security headers with WebSocket support
if (process.env.NODE_ENV === "production") {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            "'unsafe-eval'",
            "https://app.termly.io",
            "https://www.googletagmanager.com",
            "https://www.google-analytics.com",
            "https://ssl.google-analytics.com",
            "https://pagead2.googlesyndication.com",
            "https://googleads.g.doubleclick.net",
            "https://adservice.google.com",
          ],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://fonts.googleapis.com",
          ],
          imgSrc: ["'self'", "data:", "https:", "blob:"],
          connectSrc: [
            "'self'",
            "https:",
            "wss:",
            "ws:",
            "https://www.google-analytics.com",
            "https://stats.g.doubleclick.net",
          ],
          fontSrc: ["'self'", "data:", "https:", "https://fonts.gstatic.com"],
          frameSrc: [
            "'self'",
            "https://googleads.g.doubleclick.net",
            "https://bid.g.doubleclick.net",
          ],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],

          manifestSrc: ["'self'"],
          workerSrc: ["'self'", "blob:", "data:"],
          childSrc: ["'self'", "blob:"],
          baseUri: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(compression());
}

(async () => {
  try {
    // Create HTTP server explicitly
    const server = createServer(app);

    // Set up WebSocket server first
    const wss = setupWebSocket(app, server);
    console.log("WebSocket server initialized successfully");

    // Then register routes
    registerRoutes(app, server);

    // Rate limiting for API routes
    if (process.env.NODE_ENV === "production") {
      const limiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100,
        message: "Too many requests from this IP, please try again later.",
        skip: (req) => req.path === "/health",
      });
      app.use("/api/*", limiter);
    }

    // Health check endpoint with enhanced logging and database status
    app.get("/health", async (req, res) => {
      log("Health check endpoint accessed");

      // Get memory statistics
      const heapUsed = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      const heapTotal = Math.round(
        process.memoryUsage().heapTotal / 1024 / 1024,
      );
      const rss = Math.round(process.memoryUsage().rss / 1024 / 1024);

      // Check database health
      const { checkDatabaseHealth, getDatabaseStats } = await import(
        "@db/connection"
      );
      const dbHealth = await checkDatabaseHealth();
      const dbStats = getDatabaseStats();

      res.status(200).json({
        status: dbHealth ? "healthy" : "degraded",
        memory: {
          heapUsed: `${heapUsed}MB`,
          heapTotal: `${heapTotal}MB`,
          rss: `${rss}MB`,
        },
        database: {
          healthy: dbHealth,
          connections: dbStats,
        },
        timestamp: new Date().toISOString(),
        uptime: `${Math.floor(process.uptime())}s`,
      });
    });

    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      app.use(express.static(path.join(__dirname, "../dist/public")));
    }

    app.use(
      "/uploads",
      express.static(path.join(process.cwd(), "public/uploads")),
    );

    // Enhanced error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error("Error details:", err);
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      log(`Error occurred: ${err.stack || err}`);
      res.status(status).json({
        error: message,
        details: process.env.NODE_ENV === "development" ? err.stack : undefined,
      });
    });

    // SPA fallback
    app.use("*", (req, res, next) => {
      if (req.originalUrl.startsWith("/api")) {
        return next();
      }

      if (app.get("env") === "development") {
        next();
      } else {
        res.sendFile(path.join(__dirname, "../dist/public/index.html"));
      }
    });

    // Start server with enhanced logging and port fallback
    const startServer = (port: number, maxRetries = 10) => {
      if (maxRetries <= 0) {
        throw new Error("Could not find available port after maximum retries");
      }

      // Setup error handler before attempting to listen
      const errorHandler = (e: any) => {
        if (e.code === "EADDRINUSE") {
          console.log(`Port ${port} is in use, trying ${port + 1}`);
          // Remove the listener to avoid stacking
          server.removeListener("error", errorHandler);
          // Try the next port
          startServer(port + 1, maxRetries - 1);
        } else {
          console.error("Server error:", e);
          throw e;
        }
      };

      server.on("error", errorHandler);

      try {
        server.listen(port, HOST, () => {
          // Success! Remove error handler to avoid leaking
          server.removeListener("error", errorHandler);

          const actualPort = (server.address() as any)?.port || port;
          const mode = process.env.NODE_ENV || "development";

          log(`Server started successfully:`);
          log(`- Port: ${actualPort}`);
          log(`- Mode: ${mode}`);
          log(`- Host: ${HOST}`);
          log(`- Upload limit: 25MB`);

          // Add the port to an environment variable so other parts can access it
          process.env.SERVER_PORT = String(actualPort);

          // Set up enhanced health check interval
          setInterval(() => {
            const used = process.memoryUsage();
            const systemStatus = {
              memory: {
                heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)}MB`,
                heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)}MB`,
                rss: `${Math.round(used.rss / 1024 / 1024)}MB`,
              },
              uptime: `${Math.round(process.uptime())}s`,
              timestamp: new Date().toISOString(),
            };
            log(
              `Health check - Server status: ${JSON.stringify(systemStatus)}`,
            );
          }, 30000);
        });
      } catch (e) {
        console.error("Error during server startup:", e);
        throw e;
      }
    };

    startServer(PORT);
  } catch (error) {
    console.error("Fatal error during server startup:", error);
    process.exit(1);
  }
})();
