import { defineAction, z, type ActionsModule } from "@hatch/space-sdk";
import { asc, desc, eq } from "drizzle-orm";
import * as schema from "./schema";

const projectStatus = z.enum(["active", "paused"]);
const keywordIntent = z.enum([
  "informational",
  "commercial",
  "transactional",
  "navigational",
]);
const articleStatus = z.enum(["idea", "drafting", "review", "published"]);
const backlinkType = z.enum(["guest_post", "social", "forum", "pr", "other"]);
const backlinkStatus = z.enum(["live", "pending", "lost"]);

const projectOut = z.object({
  id: z.number(),
  name: z.string(),
  domain: z.string(),
  status: projectStatus,
  created_at: z.string(),
});

const keywordOut = z.object({
  id: z.number(),
  projectId: z.number(),
  keyword: z.string(),
  cluster: z.string(),
  intent: keywordIntent,
  volume: z.number().nullable(),
  difficulty: z.number().nullable(),
  position: z.number().nullable(),
  targetUrl: z.string(),
  notes: z.string(),
  updated_at: z.string(),
});

const articleOut = z.object({
  id: z.number(),
  projectId: z.number(),
  title: z.string(),
  url: z.string(),
  keywordId: z.number().nullable(),
  status: articleStatus,
  author: z.string(),
  wordCount: z.number().nullable(),
  publishDate: z.string().nullable(),
  notes: z.string(),
  updated_at: z.string(),
});

const backlinkOut = z.object({
  id: z.number(),
  projectId: z.number(),
  sourceUrl: z.string(),
  targetUrl: z.string(),
  anchor: z.string(),
  type: backlinkType,
  dofollow: z.boolean(),
  status: backlinkStatus,
  cost: z.number().nullable(),
  acquiredDate: z.string().nullable(),
  notes: z.string(),
  updated_at: z.string(),
});

const keywordFields = {
  keyword: z.string().trim().min(1),
  cluster: z.string().trim().default(""),
  intent: keywordIntent.default("informational"),
  volume: z.number().int().min(0).nullable().default(null),
  difficulty: z.number().int().min(0).max(100).nullable().default(null),
  position: z.number().int().min(1).nullable().default(null),
  targetUrl: z.string().trim().default(""),
  notes: z.string().trim().default(""),
};

const articleFields = {
  title: z.string().trim().min(1),
  url: z.string().trim().default(""),
  keywordId: z.number().int().positive().nullable().default(null),
  status: articleStatus.default("idea"),
  author: z.string().trim().default(""),
  wordCount: z.number().int().min(0).nullable().default(null),
  publishDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
  notes: z.string().trim().default(""),
};

const backlinkFields = {
  sourceUrl: z.string().trim().min(1),
  targetUrl: z.string().trim().default(""),
  anchor: z.string().trim().default(""),
  type: backlinkType.default("other"),
  dofollow: z.boolean().default(true),
  status: backlinkStatus.default("live"),
  cost: z.number().int().min(0).nullable().default(null),
  acquiredDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
  notes: z.string().trim().default(""),
};

const okResponse = z.object({ ok: z.literal(true) });

export const Actions = {
  // ---------- Projects ----------
  listProjects: defineAction({
    request: z.object({}),
    response: z.object({ projects: z.array(projectOut) }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.projects)
        .orderBy(asc(schema.projects.id));
      return {
        projects: rows.map((r) => ({
          id: r.id,
          name: r.name,
          domain: r.domain,
          status: r.status,
          created_at: r.createdAt.toISOString(),
        })),
      };
    },
  }),

  createProject: defineAction({
    request: z.object({
      name: z.string().trim().min(1),
      domain: z.string().trim().default(""),
      status: projectStatus.default("active"),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [row] = await db
        .insert(schema.projects)
        .values({ name: args.name, domain: args.domain, status: args.status })
        .returning({ id: schema.projects.id });
      if (!row) throw new Error("createProject: insert returned no rows");
      ctx.invalidateQueries();
      return { id: row.id };
    },
  }),

  updateProject: defineAction({
    request: z.object({
      id: z.number().int().positive(),
      name: z.string().trim().min(1),
      domain: z.string().trim().default(""),
      status: projectStatus,
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.projects)
        .set({ name: args.name, domain: args.domain, status: args.status })
        .where(eq(schema.projects.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  deleteProject: defineAction({
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      await db.batch([
        db.delete(schema.keywords).where(eq(schema.keywords.projectId, args.id)),
        db.delete(schema.articles).where(eq(schema.articles.projectId, args.id)),
        db
          .delete(schema.backlinks)
          .where(eq(schema.backlinks.projectId, args.id)),
        db.delete(schema.projects).where(eq(schema.projects.id, args.id)),
      ]);
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  // ---------- Dashboard ----------
  getDashboard: defineAction({
    request: z.object({ projectId: z.number().int().positive() }),
    response: z.object({
      keywordCount: z.number(),
      top3: z.number(),
      top10: z.number(),
      top100: z.number(),
      unranked: z.number(),
      articleCount: z.number(),
      publishedCount: z.number(),
      backlinkCount: z.number(),
      liveBacklinks: z.number(),
      lostBacklinks: z.number(),
      pendingBacklinks: z.number(),
      backlinkCost: z.number(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const kws = await db
        .select({ position: schema.keywords.position })
        .from(schema.keywords)
        .where(eq(schema.keywords.projectId, args.projectId));
      const arts = await db
        .select({ status: schema.articles.status })
        .from(schema.articles)
        .where(eq(schema.articles.projectId, args.projectId));
      const bls = await db
        .select({ status: schema.backlinks.status, cost: schema.backlinks.cost })
        .from(schema.backlinks)
        .where(eq(schema.backlinks.projectId, args.projectId));
      return {
        keywordCount: kws.length,
        top3: kws.filter((k) => k.position != null && k.position <= 3).length,
        top10: kws.filter((k) => k.position != null && k.position <= 10).length,
        top100: kws.filter((k) => k.position != null && k.position <= 100)
          .length,
        unranked: kws.filter((k) => k.position == null).length,
        articleCount: arts.length,
        publishedCount: arts.filter((a) => a.status === "published").length,
        backlinkCount: bls.length,
        liveBacklinks: bls.filter((b) => b.status === "live").length,
        lostBacklinks: bls.filter((b) => b.status === "lost").length,
        pendingBacklinks: bls.filter((b) => b.status === "pending").length,
        backlinkCost: bls.reduce((sum, b) => sum + (b.cost ?? 0), 0),
      };
    },
  }),

  // ---------- Keywords ----------
  listKeywords: defineAction({
    request: z.object({ projectId: z.number().int().positive() }),
    response: z.object({ keywords: z.array(keywordOut) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.keywords)
        .where(eq(schema.keywords.projectId, args.projectId))
        .orderBy(asc(schema.keywords.keyword));
      return {
        keywords: rows.map((r) => ({
          id: r.id,
          projectId: r.projectId,
          keyword: r.keyword,
          cluster: r.cluster,
          intent: r.intent,
          volume: r.volume,
          difficulty: r.difficulty,
          position: r.position,
          targetUrl: r.targetUrl,
          notes: r.notes,
          updated_at: r.updatedAt.toISOString(),
        })),
      };
    },
  }),

  createKeyword: defineAction({
    request: z.object({
      projectId: z.number().int().positive(),
      ...keywordFields,
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [row] = await db
        .insert(schema.keywords)
        .values({
          projectId: args.projectId,
          keyword: args.keyword,
          cluster: args.cluster,
          intent: args.intent,
          volume: args.volume,
          difficulty: args.difficulty,
          position: args.position,
          targetUrl: args.targetUrl,
          notes: args.notes,
        })
        .returning({ id: schema.keywords.id });
      if (!row) throw new Error("createKeyword: insert returned no rows");
      ctx.invalidateQueries();
      return { id: row.id };
    },
  }),

  updateKeyword: defineAction({
    request: z.object({ id: z.number().int().positive(), ...keywordFields }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.keywords)
        .set({
          keyword: args.keyword,
          cluster: args.cluster,
          intent: args.intent,
          volume: args.volume,
          difficulty: args.difficulty,
          position: args.position,
          targetUrl: args.targetUrl,
          notes: args.notes,
          updatedAt: new Date(),
        })
        .where(eq(schema.keywords.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  deleteKeyword: defineAction({
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.articles)
        .set({ keywordId: null })
        .where(eq(schema.articles.keywordId, args.id));
      await db.delete(schema.keywords).where(eq(schema.keywords.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  // ---------- Articles ----------
  listArticles: defineAction({
    request: z.object({ projectId: z.number().int().positive() }),
    response: z.object({ articles: z.array(articleOut) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.articles)
        .where(eq(schema.articles.projectId, args.projectId))
        .orderBy(desc(schema.articles.updatedAt));
      return {
        articles: rows.map((r) => ({
          id: r.id,
          projectId: r.projectId,
          title: r.title,
          url: r.url,
          keywordId: r.keywordId,
          status: r.status,
          author: r.author,
          wordCount: r.wordCount,
          publishDate: r.publishDate,
          notes: r.notes,
          updated_at: r.updatedAt.toISOString(),
        })),
      };
    },
  }),

  createArticle: defineAction({
    request: z.object({
      projectId: z.number().int().positive(),
      ...articleFields,
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [row] = await db
        .insert(schema.articles)
        .values({
          projectId: args.projectId,
          title: args.title,
          url: args.url,
          keywordId: args.keywordId,
          status: args.status,
          author: args.author,
          wordCount: args.wordCount,
          publishDate: args.publishDate,
          notes: args.notes,
        })
        .returning({ id: schema.articles.id });
      if (!row) throw new Error("createArticle: insert returned no rows");
      ctx.invalidateQueries();
      return { id: row.id };
    },
  }),

  updateArticle: defineAction({
    request: z.object({ id: z.number().int().positive(), ...articleFields }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.articles)
        .set({
          title: args.title,
          url: args.url,
          keywordId: args.keywordId,
          status: args.status,
          author: args.author,
          wordCount: args.wordCount,
          publishDate: args.publishDate,
          notes: args.notes,
          updatedAt: new Date(),
        })
        .where(eq(schema.articles.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  deleteArticle: defineAction({
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      await db.delete(schema.articles).where(eq(schema.articles.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  // ---------- Backlinks ----------
  listBacklinks: defineAction({
    request: z.object({ projectId: z.number().int().positive() }),
    response: z.object({ backlinks: z.array(backlinkOut) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.backlinks)
        .where(eq(schema.backlinks.projectId, args.projectId))
        .orderBy(desc(schema.backlinks.updatedAt));
      return {
        backlinks: rows.map((r) => ({
          id: r.id,
          projectId: r.projectId,
          sourceUrl: r.sourceUrl,
          targetUrl: r.targetUrl,
          anchor: r.anchor,
          type: r.type,
          dofollow: r.dofollow === 1,
          status: r.status,
          cost: r.cost,
          acquiredDate: r.acquiredDate,
          notes: r.notes,
          updated_at: r.updatedAt.toISOString(),
        })),
      };
    },
  }),

  createBacklink: defineAction({
    request: z.object({
      projectId: z.number().int().positive(),
      ...backlinkFields,
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [row] = await db
        .insert(schema.backlinks)
        .values({
          projectId: args.projectId,
          sourceUrl: args.sourceUrl,
          targetUrl: args.targetUrl,
          anchor: args.anchor,
          type: args.type,
          dofollow: args.dofollow ? 1 : 0,
          status: args.status,
          cost: args.cost,
          acquiredDate: args.acquiredDate,
          notes: args.notes,
        })
        .returning({ id: schema.backlinks.id });
      if (!row) throw new Error("createBacklink: insert returned no rows");
      ctx.invalidateQueries();
      return { id: row.id };
    },
  }),

  updateBacklink: defineAction({
    request: z.object({ id: z.number().int().positive(), ...backlinkFields }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.backlinks)
        .set({
          sourceUrl: args.sourceUrl,
          targetUrl: args.targetUrl,
          anchor: args.anchor,
          type: args.type,
          dofollow: args.dofollow ? 1 : 0,
          status: args.status,
          cost: args.cost,
          acquiredDate: args.acquiredDate,
          notes: args.notes,
          updatedAt: new Date(),
        })
        .where(eq(schema.backlinks.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  deleteBacklink: defineAction({
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      await db
        .delete(schema.backlinks)
        .where(eq(schema.backlinks.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),
} satisfies ActionsModule;
