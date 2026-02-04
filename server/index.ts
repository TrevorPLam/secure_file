// AI-META-BEGIN
// AI-META: Express server entry point - initializes HTTP server, middleware, routes, and serves both API and frontend
// OWNERSHIP: server/core
// ENTRYPOINTS: Application bootstrap - node dist/index.cjs (production) or tsx server/index.ts (development)
// DEPENDENCIES: express, ./routes (registerRoutes), ./static (serveStatic), ./vite (setupVite in dev), http
// DANGER: Global error handler - uncaught errors in routes will be caught here; middleware order matters; production/dev branch affects bundle serving
// CHANGE-SAFETY: Safe to modify logging format, unsafe to change middleware order or port binding logic (firewalled ports)
// TESTS: Run `npm run build` to validate production bundle, `npm run dev` for development server, `npm run check` for type safety
// AI-META-END

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { applySecurityMiddleware } from "./security";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// AI-NOTE: Raw body capture for webhook signature verification or custom parsing
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Apply security middleware (headers, CORS, rate limiting)
applySecurityMiddleware(app);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      // AI-NOTE: Security fix - do not log response bodies to prevent token/password leakage
      // Only log metadata for debugging
      if (capturedJsonResponse && res.statusCode >= 400) {
        // Only log error responses (sanitized)
        const sanitized = { message: capturedJsonResponse.message || 'Error' };
        logLine += ` :: ${JSON.stringify(sanitized)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  // AI-NOTE: Global error handler - must be registered after routes to catch downstream errors
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log full error server-side for debugging
    console.error("Internal Server Error:", {
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      status,
    });

    if (res.headersSent) {
      return next(err);
    }

    // AI-NOTE: Security fix - never expose stack traces to clients in production
    const errorResponse: any = {
      message: status >= 500 ? "Internal Server Error" : message,
      status,
    };

    // Only include stack traces in development mode
    if (process.env.NODE_ENV === 'development') {
      errorResponse.stack = err.stack;
    }

    return res.status(status).json(errorResponse);
  });

  // AI-NOTE: Production serves prebuilt static files; dev mode uses Vite HMR - order matters to avoid catch-all conflicts
  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
