import { eq, desc, isNull, sql, and, or, gte, lte } from "drizzle-orm";
import type { DB } from "./client";
import {
  artists,
  posts,
  images,
  hashtags,
  postHashtags,
  scrapeJobs,
  prompts,
  generations,
  type NewArtist,
  type NewPost,
  type NewImage,
  type NewHashtag,
  type NewScrapeJob,
  type NewPrompt,
  type NewGeneration,
} from "./schema";

// ============ ARTISTS ============

export async function upsertArtist(db: DB, data: NewArtist) {
  const existing = await db.query.artists.findFirst({
    where: eq(artists.username, data.username),
  });
  if (existing) {
    await db.update(artists)
      .set({ ...data, scrapedAt: new Date(), updatedAt: new Date() })
      .where(eq(artists.id, existing.id));
    return { ...existing, ...data };
  }
  const [row] = await db.insert(artists).values({ ...data, scrapedAt: new Date() }).returning();
  return row;
}

export async function getArtistByUsername(db: DB, username: string) {
  return db.query.artists.findFirst({ where: eq(artists.username, username) });
}

export async function getArtistById(db: DB, id: number) {
  return db.query.artists.findFirst({ where: eq(artists.id, id) });
}

export async function listArtists(db: DB, opts: {
  limit?: number;
  offset?: number;
  minFollowers?: number;
  maxFollowers?: number;
  search?: string;
} = {}) {
  const { limit = 60, offset = 0, minFollowers, maxFollowers, search } = opts;
  const conditions = [] as any[];
  if (typeof minFollowers === "number") conditions.push(gte(artists.followersCount, minFollowers));
  if (typeof maxFollowers === "number") conditions.push(lte(artists.followersCount, maxFollowers));
  if (search && search.length > 0) {
    const like = `%${search.toLowerCase()}%`;
    conditions.push(
      or(
        sql`lower(${artists.username}) like ${like}`,
        sql`lower(coalesce(${artists.fullName}, '')) like ${like}`,
      )!
    );
  }
  const where = conditions.length ? and(...conditions) : undefined;
  const rows = await db.query.artists.findMany({
    where,
    orderBy: desc(artists.scrapedAt),
    limit,
    offset,
  });
  const totalRow = await db
    .select({ count: sql<number>`count(*)` })
    .from(artists)
    .where(where ?? sql`1=1`);
  return { rows, total: totalRow[0]?.count ?? 0 };
}

export async function getArtistDetail(db: DB, username: string) {
  const artist = await db.query.artists.findFirst({
    where: eq(artists.username, username),
    with: {
      posts: {
        orderBy: desc(posts.postedAt),
        with: { images: true },
      },
    },
  });
  return artist ?? null;
}

// ============ POSTS ============

export async function upsertPost(db: DB, data: NewPost) {
  const existing = await db.query.posts.findFirst({ where: eq(posts.shortcode, data.shortcode) });
  if (existing) {
    await db.update(posts)
      .set({ ...data, scrapedAt: new Date(), updatedAt: new Date() })
      .where(eq(posts.id, existing.id));
    return { ...existing, ...data };
  }
  const [row] = await db.insert(posts).values({ ...data, scrapedAt: new Date() }).returning();
  return row;
}

export async function getPostByShortcode(db: DB, shortcode: string) {
  return db.query.posts.findFirst({
    where: eq(posts.shortcode, shortcode),
    with: { artist: true, images: true },
  });
}

export async function getPostsByArtist(db: DB, artistId: number) {
  return db.query.posts.findMany({
    where: eq(posts.artistId, artistId),
    orderBy: desc(posts.postedAt),
    with: { images: true },
  });
}

export async function updatePostImageKey(db: DB, shortcode: string, key: string) {
  await db.update(posts)
    .set({ imageKey: key, updatedAt: new Date() })
    .where(eq(posts.shortcode, shortcode));
}

// ============ IMAGES ============

export async function insertImage(db: DB, data: NewImage) {
  const [row] = await db.insert(images).values(data).returning();
  return row;
}

export async function updateImageR2Key(db: DB, imageId: number, key: string) {
  await db.update(images)
    .set({ r2Key: key, downloadedAt: new Date() })
    .where(eq(images.id, imageId));
}

export async function getImagesByPost(db: DB, postId: number) {
  return db.query.images.findMany({ where: eq(images.postId, postId) });
}

export async function getPendingImages(db: DB) {
  return db.query.images.findMany({ where: isNull(images.downloadedAt) });
}

// ============ HASHTAGS ============

export async function upsertHashtag(db: DB, data: NewHashtag) {
  const existing = await db.query.hashtags.findFirst({ where: eq(hashtags.name, data.name) });
  if (existing) {
    await db.update(hashtags)
      .set({ ...data, lastScrapedAt: new Date() })
      .where(eq(hashtags.id, existing.id));
    return { ...existing, ...data };
  }
  const [row] = await db.insert(hashtags).values(data).returning();
  return row;
}

export async function getHashtagByName(db: DB, name: string) {
  return db.query.hashtags.findFirst({ where: eq(hashtags.name, name) });
}

export async function listTags(db: DB) {
  return db
    .select({
      id: hashtags.id,
      name: hashtags.name,
      postsCount: hashtags.postsCount,
      lastScrapedAt: hashtags.lastScrapedAt,
      isTracked: hashtags.isTracked,
      priority: hashtags.priority,
      createdAt: hashtags.createdAt,
      linkedPosts: sql<number>`(select count(*) from post_hashtags ph where ph.hashtag_id = ${hashtags.id})`,
    })
    .from(hashtags)
    .orderBy(desc(hashtags.isTracked), hashtags.priority, hashtags.name);
}

export async function listTrackedHashtags(db: DB) {
  return db.query.hashtags.findMany({
    where: eq(hashtags.isTracked, true),
    orderBy: [desc(hashtags.priority), hashtags.name],
  });
}

export async function setTagTracked(db: DB, name: string, isTracked: boolean, priority?: number) {
  const existing = await db.query.hashtags.findFirst({ where: eq(hashtags.name, name) });
  if (existing) {
    await db.update(hashtags)
      .set({ isTracked, ...(priority !== undefined ? { priority } : {}) })
      .where(eq(hashtags.id, existing.id));
    return { ...existing, isTracked, priority: priority ?? existing.priority };
  }
  const [row] = await db
    .insert(hashtags)
    .values({ name, isTracked, priority: priority ?? 0 })
    .returning();
  return row;
}

export async function deleteTag(db: DB, name: string) {
  await db.delete(hashtags).where(eq(hashtags.name, name));
}

// ============ POST-HASHTAGS ============

export async function linkPostToHashtag(db: DB, postId: number, hashtagId: number) {
  try {
    await db.insert(postHashtags).values({ postId, hashtagId });
  } catch {
    // Ignore duplicate
  }
}

// ============ SCRAPE JOBS ============

export async function createJob(db: DB, data: Pick<NewScrapeJob, "jobType" | "target">) {
  const [row] = await db.insert(scrapeJobs).values({ ...data, status: "pending" }).returning();
  return row;
}

export async function startJob(db: DB, jobId: number) {
  await db.update(scrapeJobs)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(scrapeJobs.id, jobId));
}

export async function completeJob(db: DB, jobId: number, itemsScraped: number) {
  await db.update(scrapeJobs)
    .set({ status: "completed", itemsScraped, completedAt: new Date() })
    .where(eq(scrapeJobs.id, jobId));
}

export async function failJob(db: DB, jobId: number, errorMessage: string) {
  await db.update(scrapeJobs)
    .set({ status: "failed", errorMessage, completedAt: new Date() })
    .where(eq(scrapeJobs.id, jobId));
}

export async function updateJobProgress(db: DB, jobId: number, itemsScraped: number) {
  await db.update(scrapeJobs)
    .set({ itemsScraped })
    .where(eq(scrapeJobs.id, jobId));
}

export async function getJob(db: DB, jobId: number) {
  return db.query.scrapeJobs.findFirst({ where: eq(scrapeJobs.id, jobId) });
}

export async function claimNextPendingJob(db: DB) {
  // D1 doesn't expose multi-statement transactions over HTTP, so this is
  // best-effort: read oldest pending, then flip to running. Two callers racing
  // for the same job is rare in practice (scrape-next is single-operator), and
  // the second startJob is a no-op if status is already running.
  const next = await db.query.scrapeJobs.findFirst({
    where: eq(scrapeJobs.status, "pending"),
    orderBy: scrapeJobs.createdAt,
  });
  if (!next) return null;
  await db.update(scrapeJobs)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(scrapeJobs.id, next.id));
  return { id: next.id, jobType: next.jobType, target: next.target };
}

export async function countPendingJobs(db: DB): Promise<number> {
  const r = await db
    .select({ c: sql<number>`count(*)` })
    .from(scrapeJobs)
    .where(eq(scrapeJobs.status, "pending"));
  return r[0]?.c ?? 0;
}

export async function listJobs(db: DB, opts: { limit?: number; status?: string } = {}) {
  const { limit = 50, status } = opts;
  const where = status
    ? eq(scrapeJobs.status, status as "pending" | "running" | "completed" | "failed")
    : undefined;
  return db.query.scrapeJobs.findMany({
    where,
    orderBy: desc(scrapeJobs.createdAt),
    limit,
  });
}

// ============ PROMPTS ============

export async function listPrompts(db: DB, opts: { kind?: "generate" | "cleanup" } = {}) {
  return db.query.prompts.findMany({
    where: opts.kind ? eq(prompts.kind, opts.kind) : undefined,
    orderBy: desc(prompts.updatedAt),
  });
}

export async function getActiveCleanupPrompt(db: DB) {
  return db.query.prompts.findFirst({
    where: eq(prompts.kind, "cleanup"),
    orderBy: desc(prompts.updatedAt),
  });
}

export async function getPrompt(db: DB, id: number) {
  return db.query.prompts.findFirst({ where: eq(prompts.id, id) });
}

export async function createPrompt(db: DB, data: NewPrompt) {
  const [row] = await db.insert(prompts).values(data).returning();
  return row;
}

export async function updatePrompt(db: DB, id: number, data: Partial<NewPrompt>) {
  const current = await db.query.prompts.findFirst({ where: eq(prompts.id, id) });
  if (!current) return null;
  const patch: Partial<NewPrompt> = { ...data, updatedAt: new Date() };
  if (typeof data.body === "string" && data.body !== current.body) {
    patch.previousBody = current.body;
  }
  await db.update(prompts).set(patch).where(eq(prompts.id, id));
  return db.query.prompts.findFirst({ where: eq(prompts.id, id) });
}

export async function undoPrompt(db: DB, id: number) {
  const current = await db.query.prompts.findFirst({ where: eq(prompts.id, id) });
  if (!current || !current.previousBody) return null;
  await db.update(prompts)
    .set({ body: current.previousBody, previousBody: null, updatedAt: new Date() })
    .where(eq(prompts.id, id));
  return db.query.prompts.findFirst({ where: eq(prompts.id, id) });
}

export async function deletePrompt(db: DB, id: number) {
  await db.update(generations).set({ promptId: null }).where(eq(generations.promptId, id));
  await db.delete(prompts).where(eq(prompts.id, id));
}

// ============ GENERATIONS ============

export async function listGenerationsByArtist(db: DB, artistId: number) {
  return db.query.generations.findMany({
    where: eq(generations.artistId, artistId),
    orderBy: desc(generations.createdAt),
  });
}

export async function getGeneration(db: DB, id: number) {
  return db.query.generations.findFirst({ where: eq(generations.id, id) });
}

export async function createGeneration(db: DB, data: NewGeneration) {
  const [row] = await db.insert(generations).values(data).returning();
  return row;
}

export async function updateGeneration(db: DB, id: number, patch: Partial<NewGeneration>) {
  await db.update(generations)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(generations.id, id));
  return db.query.generations.findFirst({ where: eq(generations.id, id) });
}

export async function editGenerationOutput(db: DB, id: number, output: string) {
  await db.update(generations)
    .set({ output, updatedAt: new Date() })
    .where(eq(generations.id, id));
  return db.query.generations.findFirst({ where: eq(generations.id, id) });
}

export async function deleteGeneration(db: DB, id: number) {
  await db.delete(generations).where(eq(generations.id, id));
}
