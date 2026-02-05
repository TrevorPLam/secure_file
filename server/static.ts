// AI-META-BEGIN
// AI-META: Static file serving for production builds - serves prebuilt client assets and SPA fallback
// OWNERSHIP: server/static
// ENTRYPOINTS: Called from server/index.ts in production mode only
// DEPENDENCIES: express, fs, path
// DANGER: Missing dist/public directory causes startup failure; catch-all route must be last to avoid shadowing API routes
// CHANGE-SAFETY: Safe to adjust cache headers, unsafe to change fallback logic or path resolution without testing routing
// TESTS: Run `npm run build` then `npm start` to test production serving
// AI-META-END

import express, { type Express } from 'express'
import fs from 'fs'
import path from 'path'

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, 'public')
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    )
  }

  app.use(express.static(distPath))

  // fall through to index.html if the file doesn't exist
  app.use('/{*path}', (_req, res) => {
    res.sendFile(path.resolve(distPath, 'index.html'))
  })
}
