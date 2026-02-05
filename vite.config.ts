// AI-META-BEGIN
// AI-META: Vite configuration - dev server, build settings, path aliases, and Replit-specific plugins
// OWNERSHIP: config/build
// ENTRYPOINTS: Used by vite dev server and build process
// DEPENDENCIES: vite, @vitejs/plugin-react, @replit/* plugins (dev-only)
// DANGER: Path aliases (@, @shared, @assets) must match tsconfig; client root means HTML served from client/; Replit plugins enabled only in dev on Replit
// CHANGE-SAFETY: Safe to add plugins or adjust build options, unsafe to change aliases without updating imports
// TESTS: Run `npm run build` to verify production build, `npm run dev` for dev server
// AI-META-END

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal'

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' && process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then(m => m.cartographer()),
          await import('@replit/vite-plugin-dev-banner').then(m => m.devBanner()),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'client', 'src'),
      '@shared': path.resolve(import.meta.dirname, 'shared'),
      '@assets': path.resolve(import.meta.dirname, 'attached_assets'),
    },
  },
  root: path.resolve(import.meta.dirname, 'client'),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ['**/.*'],
    },
  },
})
