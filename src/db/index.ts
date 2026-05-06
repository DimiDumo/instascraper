import { eq, desc, isNull, sql, and, or, gte, lte } from "drizzle-orm";
import { db } from "./client";
import {
  artists,
  posts,
  images,
  hashtags,
  postHashtags,
  scrapeJobs,
  type NewArtist,
  type NewPost,
  type NewImage,
  type NewHashtag,
  type NewScrapeJob,
} from "./schema";

// ============ ARTISTS ============

export function upsertArtist(data: NewArtist) {
  const existing = db.query.artists.findFirst({
    where: eq(artists.username, data.username),
  }).sync();

  if (existing) {
    db.update(artists)
      .set({ ...data, scrapedAt: new Date(), updatedAt: new Date() })
      .where(eq(artists.id, existing.id))
      .run();
    return { ...existing, ...data };
  }

  const result = db.insert(artists).values({
    ...data,
    scrapedAt: new Date(),
  }).returning().get();

  return result;
}

export function getArtistByUsername(username: string) {
  return db.query.artists.findFirst({
    where: eq(artists.username, username),
  }).sync();
}

export function getAllArtists() {
  return db.query.artists.findMany({
    orderBy: desc(artists.scrapedAt),
  }).sync();
}

export function listArtists(opts: {
  limit?: number;
  offset?: number;
  minFollowers?: number;
  maxFollowers?: number;
  search?: string;
} = {}) {
  const { limit = 60, offset = 0, minFollowers, maxFollowers, search } = opts;
  const conditions = [];
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
  const rows = db.query.artists.findMany({
    where,
    orderBy: desc(artists.scrapedAt),
    limit,
    offset,
  }).sync();
  const totalRow = db
    .select({ count: sql<number>`count(*)` })
    .from(artists)
    .where(where ?? sql`1=1`)
    .get();
  return { rows, total: totalRow?.count ?? 0 };
}

export function getArtistDetail(username: string) {
  const artist = db.query.artists.findFirst({
    where: eq(artists.username, username),
    with: {
      posts: {
        orderBy: desc(posts.postedAt),
        with: { images: true },
      },
    },
  }).sync();
  return artist ?? null;
}

// ============ POSTS ============

export function upsertPost(data: NewPost) {
  const existing = db.query.posts.findFirst({
    where: eq(posts.shortcode, data.shortcode),
  }).sync();

  if (existing) {
    db.update(posts)
      .set({ ...data, scrapedAt: new Date(), updatedAt: new Date() })
      .where(eq(posts.id, existing.id))
      .run();
    return { ...existing, ...data };
  }

  const result = db.insert(posts).values({
    ...data,
    scrapedAt: new Date(),
  }).returning().get();

  return result;
}

export function getPostByShortcode(shortcode: string) {
  return db.query.posts.findFirst({
    where: eq(posts.shortcode, shortcode),
    with: {
      artist: true,
      images: true,
    },
  }).sync();
}

export function getPostsByArtist(artistId: number) {
  return db.query.posts.findMany({
    where: eq(posts.artistId, artistId),
    orderBy: desc(posts.postedAt),
    with: {
      images: true,
    },
  }).sync();
}

export function updatePostImagePath(shortcode: string, localPath: string) {
  db.update(posts)
    .set({ imageLocalPath: localPath, updatedAt: new Date() })
    .where(eq(posts.shortcode, shortcode))
    .run();
}

// ============ IMAGES ============

export function insertImage(data: NewImage) {
  const result = db.insert(images).values(data).returning().get();
  return result;
}

export function updateImageLocalPath(imageId: number, localPath: string) {
  db.update(images)
    .set({ localPath, downloadedAt: new Date() })
    .where(eq(images.id, imageId))
    .run();
}

export function getImagesByPost(postId: number) {
  return db.query.images.findMany({
    where: eq(images.postId, postId),
  }).sync();
}

export function getPendingImages() {
  return db.query.images.findMany({
    where: isNull(images.downloadedAt),
  }).sync();
}

// ============ HASHTAGS ============

export function upsertHashtag(data: NewHashtag) {
  const existing = db.query.hashtags.findFirst({
    where: eq(hashtags.name, data.name),
  }).sync();

  if (existing) {
    db.update(hashtags)
      .set({ ...data, lastScrapedAt: new Date() })
      .where(eq(hashtags.id, existing.id))
      .run();
    return { ...existing, ...data };
  }

  const result = db.insert(hashtags).values(data).returning().get();
  return result;
}

export function getHashtagByName(name: string) {
  return db.query.hashtags.findFirst({
    where: eq(hashtags.name, name),
  }).sync();
}

export function getAllHashtags() {
  return db.query.hashtags.findMany({
    orderBy: desc(hashtags.lastScrapedAt),
  }).sync();
}

export function listTags() {
  const rows = db
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
    .orderBy(desc(hashtags.isTracked), hashtags.priority, hashtags.name)
    .all();
  return rows;
}

export function listTrackedHashtags() {
  return db.query.hashtags.findMany({
    where: eq(hashtags.isTracked, true),
    orderBy: [desc(hashtags.priority), hashtags.name],
  }).sync();
}

export function setTagTracked(name: string, isTracked: boolean, priority?: number) {
  const existing = db.query.hashtags.findFirst({
    where: eq(hashtags.name, name),
  }).sync();
  if (existing) {
    db.update(hashtags)
      .set({ isTracked, ...(priority !== undefined ? { priority } : {}) })
      .where(eq(hashtags.id, existing.id))
      .run();
    return { ...existing, isTracked, priority: priority ?? existing.priority };
  }
  const inserted = db
    .insert(hashtags)
    .values({ name, isTracked, priority: priority ?? 0 })
    .returning()
    .get();
  return inserted;
}

export function deleteTag(name: string) {
  db.delete(hashtags).where(eq(hashtags.name, name)).run();
}

// ============ POST-HASHTAGS ============

export function linkPostToHashtag(postId: number, hashtagId: number) {
  try {
    db.insert(postHashtags).values({ postId, hashtagId }).run();
  } catch (error) {
    // Ignore duplicate key errors
  }
}

export function getPostsByHashtag(hashtagId: number) {
  return db.query.postHashtags.findMany({
    where: eq(postHashtags.hashtagId, hashtagId),
    with: {
      post: {
        with: {
          artist: true,
          images: true,
        },
      },
    },
  }).sync();
}

// ============ SCRAPE JOBS ============

export function createJob(data: Pick<NewScrapeJob, "jobType" | "target">) {
  const result = db.insert(scrapeJobs).values({
    ...data,
    status: "pending",
  }).returning().get();

  return result;
}

export function startJob(jobId: number) {
  db.update(scrapeJobs)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(scrapeJobs.id, jobId))
    .run();
}

export function completeJob(jobId: number, itemsScraped: number) {
  db.update(scrapeJobs)
    .set({
      status: "completed",
      itemsScraped,
      completedAt: new Date(),
    })
    .where(eq(scrapeJobs.id, jobId))
    .run();
}

export function failJob(jobId: number, errorMessage: string) {
  db.update(scrapeJobs)
    .set({
      status: "failed",
      errorMessage,
      completedAt: new Date(),
    })
    .where(eq(scrapeJobs.id, jobId))
    .run();
}

export function updateJobProgress(jobId: number, itemsScraped: number) {
  db.update(scrapeJobs)
    .set({ itemsScraped })
    .where(eq(scrapeJobs.id, jobId))
    .run();
}

export function getJob(jobId: number) {
  return db.query.scrapeJobs.findFirst({
    where: eq(scrapeJobs.id, jobId),
  }).sync();
}

export function getRecentJobs(limit = 20) {
  return db.query.scrapeJobs.findMany({
    orderBy: desc(scrapeJobs.createdAt),
    limit,
  }).sync();
}

export function getRunningJobs() {
  return db.query.scrapeJobs.findMany({
    where: eq(scrapeJobs.status, "running"),
  }).sync();
}

export function claimNextPendingJob(): { id: number; jobType: "hashtag" | "artist"; target: string } | null {
  const next = db.query.scrapeJobs.findFirst({
    where: eq(scrapeJobs.status, "pending"),
    orderBy: scrapeJobs.createdAt,
  }).sync();
  if (!next) return null;
  db.update(scrapeJobs)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(scrapeJobs.id, next.id))
    .run();
  return { id: next.id, jobType: next.jobType as "hashtag" | "artist", target: next.target };
}

export function countPendingJobs(): number {
  const r = db.select({ c: sql<number>`count(*)` }).from(scrapeJobs).where(eq(scrapeJobs.status, "pending")).get();
  return r?.c ?? 0;
}

export function listJobs(opts: { limit?: number; status?: string } = {}) {
  const { limit = 50, status } = opts;
  const where = status
    ? eq(scrapeJobs.status, status as "pending" | "running" | "completed" | "failed")
    : undefined;
  return db.query.scrapeJobs.findMany({
    where,
    orderBy: desc(scrapeJobs.createdAt),
    limit,
  }).sync();
}

// Re-export types and client
export * from "./schema";
export { db, checkConnection, closeConnection } from "./client";
