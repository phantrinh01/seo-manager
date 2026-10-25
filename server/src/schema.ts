import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  domain: text("domain").notNull().default(""),
  status: text("status", { enum: ["active", "paused"] })
    .notNull()
    .default("active"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const keywords = sqliteTable("keywords", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull(),
  keyword: text("keyword").notNull(),
  cluster: text("cluster").notNull().default(""),
  intent: text("intent", {
    enum: ["informational", "commercial", "transactional", "navigational"],
  })
    .notNull()
    .default("informational"),
  volume: integer("volume"),
  difficulty: integer("difficulty"),
  position: integer("position"),
  targetUrl: text("target_url").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const articles = sqliteTable("articles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull().default(""),
  keywordId: integer("keyword_id"),
  status: text("status", {
    enum: ["idea", "drafting", "review", "published"],
  })
    .notNull()
    .default("idea"),
  author: text("author").notNull().default(""),
  wordCount: integer("word_count"),
  publishDate: text("publish_date"),
  notes: text("notes").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const backlinks = sqliteTable("backlinks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull(),
  sourceUrl: text("source_url").notNull(),
  targetUrl: text("target_url").notNull().default(""),
  anchor: text("anchor").notNull().default(""),
  type: text("type", {
    enum: ["guest_post", "social", "forum", "pr", "other"],
  })
    .notNull()
    .default("other"),
  dofollow: integer("dofollow").notNull().default(1),
  status: text("status", { enum: ["live", "pending", "lost"] })
    .notNull()
    .default("live"),
  cost: integer("cost"),
  acquiredDate: text("acquired_date"),
  notes: text("notes").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
