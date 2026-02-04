// AI-META-BEGIN
// AI-META: Central route registration - wires up auth, object storage, and CRUD endpoints for folders/files/share links
// OWNERSHIP: server/core
// ENTRYPOINTS: Called from server/index.ts via registerRoutes(httpServer, app)
// DEPENDENCIES: express, ./storage (DatabaseStorage), ./replit_integrations/auth (setupAuth, isAuthenticated), ./replit_integrations/object_storage (ObjectStorageService), @shared/schema (validation schemas), bcryptjs (password hashing)
// DANGER: Auth middleware guards most routes - missing isAuthenticated breaks security; share link validation must check expiration and password; bcrypt comparison must be constant-time
// CHANGE-SAFETY: Safe to add new routes, unsafe to remove auth guards or change validation logic without auditing security implications
// TESTS: Run `npm run check` for type safety, manual API testing via curl/Postman for auth flows
// AI-META-END

import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { registerObjectStorageRoutes, ObjectStorageService } from "./replit_integrations/object_storage";
import { insertFolderSchema, insertFileSchema, insertShareLinkSchema } from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcryptjs";

const objectStorageService = new ObjectStorageService();

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);
  registerObjectStorageRoutes(app);

  app.get("/api/folders", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const parentId = req.query.parentId as string | undefined;
      const folders = await storage.getFoldersByParent(userId, parentId || null);
      res.json(folders);
    } catch (error) {
      console.error("Error fetching folders:", error);
      res.status(500).json({ message: "Failed to fetch folders" });
    }
  });

  app.get("/api/folders/path/:folderId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const folder = await storage.getFolder(req.params.folderId);
      if (!folder) {
        return res.status(404).json({ message: "Folder not found" });
      }
      // AI-NOTE: Authorization check - ensure user owns folder before revealing path to prevent traversal attacks
      if (folder.userId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const path = await storage.getFolderPath(req.params.folderId);
      res.json(path);
    } catch (error) {
      console.error("Error fetching folder path:", error);
      res.status(500).json({ message: "Failed to fetch folder path" });
    }
  });

  app.post("/api/folders", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const data = insertFolderSchema.parse({
        ...req.body,
        userId,
        parentId: req.body.parentId || null,
      });
      const folder = await storage.createFolder(data);
      res.status(201).json(folder);
    } catch (error) {
      console.error("Error creating folder:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid folder data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create folder" });
      }
    }
  });

  app.delete("/api/folders/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.deleteFolder(req.params.id, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting folder:", error);
      res.status(500).json({ message: "Failed to delete folder" });
    }
  });

  app.get("/api/files", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const folderId = req.query.folderId as string | undefined;
      const files = await storage.getFilesByFolder(userId, folderId || null);
      res.json(files);
    } catch (error) {
      console.error("Error fetching files:", error);
      res.status(500).json({ message: "Failed to fetch files" });
    }
  });

  app.post("/api/files", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // AI-NOTE: Object path normalization prevents directory traversal and ensures consistent storage keys
      const normalizedObjectPath = objectStorageService.normalizeObjectEntityPath(req.body.objectPath);
      
      const data = insertFileSchema.parse({
        ...req.body,
        userId,
        objectPath: normalizedObjectPath,
        folderId: req.body.folderId || null,
      });
      
      const file = await storage.createFile(data);
      res.status(201).json(file);
    } catch (error) {
      console.error("Error creating file:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid file data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create file" });
      }
    }
  });

  app.delete("/api/files/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.deleteFile(req.params.id, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting file:", error);
      res.status(500).json({ message: "Failed to delete file" });
    }
  });

  app.get("/api/files/:fileId/shares", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const file = await storage.getFile(req.params.fileId);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }
      if (file.userId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const shares = await storage.getShareLinksByFile(req.params.fileId);
      res.json(shares);
    } catch (error) {
      console.error("Error fetching share links:", error);
      res.status(500).json({ message: "Failed to fetch share links" });
    }
  });

  const createShareSchema = z.object({
    fileId: z.string().min(1),
    password: z.string().optional(),
    expiresAt: z.string().optional(),
  });

  app.post("/api/shares", isAuthenticated, async (req: any, res) => {
    try {
      const validation = createShareSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid request data", errors: validation.error.errors });
      }

      const { fileId, password, expiresAt } = validation.data;
      
      const file = await storage.getFile(fileId);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }
      
      if (file.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Not authorized" });
      }

      let hashedPassword = null;
      if (password) {
        // AI-NOTE: Bcrypt with 10 rounds for password hashing - prevents rainbow table attacks on shared links
        hashedPassword = await bcrypt.hash(password, 10);
      }

      const shareLink = await storage.createShareLink({
        fileId,
        password: hashedPassword,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: true,
      });
      
      res.status(201).json(shareLink);
    } catch (error) {
      console.error("Error creating share link:", error);
      res.status(500).json({ message: "Failed to create share link" });
    }
  });

  app.delete("/api/shares/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const shareLink = await storage.getShareLink(req.params.id);
      
      if (!shareLink) {
        return res.status(404).json({ message: "Share link not found" });
      }
      
      const file = await storage.getFile(shareLink.fileId);
      if (!file || file.userId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      await storage.deleteShareLink(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting share link:", error);
      res.status(500).json({ message: "Failed to delete share link" });
    }
  });

  app.get("/api/shares/info/:token", async (req, res) => {
    try {
      const shareLink = await storage.getShareLinkByToken(req.params.token);
      if (!shareLink || !shareLink.isActive) {
        return res.status(404).json({ message: "Share link not found" });
      }

      const file = await storage.getFile(shareLink.fileId);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      const isExpired = shareLink.expiresAt && new Date(shareLink.expiresAt) < new Date();

      res.json({
        id: shareLink.id,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.mimeType,
        hasPassword: !!shareLink.password,
        expiresAt: shareLink.expiresAt,
        isExpired,
        downloadCount: shareLink.downloadCount || 0,
      });
    } catch (error) {
      console.error("Error fetching share info:", error);
      res.status(500).json({ message: "Failed to fetch share info" });
    }
  });

  app.post("/api/shares/:token/download", async (req, res) => {
    try {
      const shareLink = await storage.getShareLinkByToken(req.params.token);
      if (!shareLink || !shareLink.isActive) {
        return res.status(404).json({ message: "Share link not found" });
      }

      // AI-NOTE: Time-based expiration check - must reject expired links to prevent unauthorized access
      if (shareLink.expiresAt && new Date(shareLink.expiresAt) < new Date()) {
        return res.status(410).json({ message: "Share link has expired" });
      }

      if (shareLink.password) {
        const { password } = req.body;
        if (!password) {
          return res.status(401).json({ message: "Password required" });
        }
        // AI-NOTE: Constant-time comparison via bcrypt prevents timing attacks on share link passwords
        const isValid = await bcrypt.compare(password, shareLink.password);
        if (!isValid) {
          return res.status(401).json({ message: "Incorrect password" });
        }
      }

      const file = await storage.getFile(shareLink.fileId);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      await storage.incrementDownloadCount(shareLink.id);

      res.json({
        downloadUrl: file.objectPath,
        fileName: file.name,
      });
    } catch (error) {
      console.error("Error processing download:", error);
      res.status(500).json({ message: "Failed to process download" });
    }
  });

  app.get("/api/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  return httpServer;
}
