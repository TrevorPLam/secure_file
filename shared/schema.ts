// AI-META-BEGIN
// AI-META: Shared database schema - Drizzle ORM table definitions, relations, and Zod validation schemas for folders, files, and share links
// OWNERSHIP: shared/schema
// ENTRYPOINTS: Imported by server (db.ts, storage.ts, routes.ts) and client (types only)
// DEPENDENCIES: drizzle-orm (ORM), drizzle-zod (schema-to-Zod conversion), zod (validation), ./models/auth (user tables)
// DANGER: UUIDs auto-generated via gen_random_uuid(); indexes on userId, parentId, folderId for query performance; relations define cascade behavior
// CHANGE-SAFETY: Safe to add new tables or columns, unsafe to change existing column types or remove indexes without migration
// TESTS: Run `npm run db:push` to sync schema with database, verify migrations
// AI-META-END

import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, bigint, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

export const folders = pgTable("folders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  parentId: varchar("parent_id"),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_folders_user").on(table.userId),
  index("idx_folders_parent").on(table.parentId),
]);

export const foldersRelations = relations(folders, ({ one, many }) => ({
  parent: one(folders, {
    fields: [folders.parentId],
    references: [folders.id],
  }),
  children: many(folders),
  files: many(files),
}));

export const files = pgTable("files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  size: bigint("size", { mode: "number" }).notNull(),
  mimeType: text("mime_type").notNull(),
  objectPath: text("object_path").notNull(),
  folderId: varchar("folder_id"),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_files_user").on(table.userId),
  index("idx_files_folder").on(table.folderId),
]);

export const filesRelations = relations(files, ({ one, many }) => ({
  folder: one(folders, {
    fields: [files.folderId],
    references: [folders.id],
  }),
  shareLinks: many(shareLinks),
}));

export const shareLinks = pgTable("share_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fileId: varchar("file_id").notNull(),
  token: varchar("token").notNull().unique(),
  expiresAt: timestamp("expires_at"),
  password: text("password"),
  downloadCount: bigint("download_count", { mode: "number" }).default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_share_links_token").on(table.token),
  index("idx_share_links_file").on(table.fileId),
]);

export const shareLinksRelations = relations(shareLinks, ({ one }) => ({
  file: one(files, {
    fields: [shareLinks.fileId],
    references: [files.id],
  }),
}));

export const insertFolderSchema = createInsertSchema(folders).omit({
  id: true,
  createdAt: true,
});

export const insertFileSchema = createInsertSchema(files).omit({
  id: true,
  createdAt: true,
});

export const insertShareLinkSchema = createInsertSchema(shareLinks).omit({
  id: true,
  createdAt: true,
  downloadCount: true,
});

export type Folder = typeof folders.$inferSelect;
export type InsertFolder = z.infer<typeof insertFolderSchema>;
export type File = typeof files.$inferSelect;
export type InsertFile = z.infer<typeof insertFileSchema>;
export type ShareLink = typeof shareLinks.$inferSelect;
export type InsertShareLink = z.infer<typeof insertShareLinkSchema>;
