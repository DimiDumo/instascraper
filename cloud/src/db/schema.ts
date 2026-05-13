import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// Artists table - Instagram user profiles
export const artists = sqliteTable(
  "artists",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull().unique(),
    fullName: text("full_name"),
    bio: text("bio"),
    followersCount: integer("followers_count"),
    followingCount: integer("following_count"),
    postsCount: integer("posts_count"),
    profilePicUrl: text("profile_pic_url"),
    profilePicKey: text("profile_pic_key"),
    isVerified: integer("is_verified", { mode: "boolean" }).default(false),
    scrapedAt: integer("scraped_at", { mode: "timestamp" }),
    hubspotContactId: text("hubspot_contact_id"),
    hubspotSyncedAt: integer("hubspot_synced_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => [index("idx_artists_username").on(table.username)]
);

// Posts table - Instagram posts
export const posts = sqliteTable(
  "posts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    instagramId: text("instagram_id").unique(),
    artistId: integer("artist_id").references(() => artists.id),
    shortcode: text("shortcode").notNull().unique(),
    caption: text("caption"),
    likesCount: integer("likes_count"),
    commentsCount: integer("comments_count"),
    postType: text("post_type", { enum: ["image", "video", "carousel"] }).default("image"),
    imageKey: text("image_key"),
    postedAt: integer("posted_at", { mode: "timestamp" }),
    scrapedAt: integer("scraped_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => [
    index("idx_posts_shortcode").on(table.shortcode),
    index("idx_posts_artist_id").on(table.artistId),
  ]
);

// Images table - Individual images from posts
export const images = sqliteTable(
  "images",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id),
    url: text("url").notNull(),
    r2Key: text("r2_key"),
    width: integer("width"),
    height: integer("height"),
    downloadedAt: integer("downloaded_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => [index("idx_images_post_id").on(table.postId)]
);

// Hashtags table - Tracked hashtags
export const hashtags = sqliteTable(
  "hashtags",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull().unique(),
    postsCount: integer("posts_count"),
    lastScrapedAt: integer("last_scraped_at", { mode: "timestamp" }),
    isTracked: integer("is_tracked", { mode: "boolean" }).default(false),
    priority: integer("priority").default(0),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => [
    index("idx_hashtags_name").on(table.name),
    index("idx_hashtags_is_tracked").on(table.isTracked),
  ]
);

// Junction table for posts and hashtags (many-to-many)
export const postHashtags = sqliteTable(
  "post_hashtags",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id),
    hashtagId: integer("hashtag_id")
      .notNull()
      .references(() => hashtags.id),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.hashtagId] }),
    index("idx_post_hashtags_post_id").on(table.postId),
    index("idx_post_hashtags_hashtag_id").on(table.hashtagId),
  ]
);

// Scrape jobs - status mirror of locally-run scrape jobs.
export const scrapeJobs = sqliteTable(
  "scrape_jobs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    jobType: text("job_type", { enum: ["hashtag", "artist"] }).notNull(),
    target: text("target").notNull(),
    status: text("status", { enum: ["pending", "running", "completed", "failed"] }).default("pending"),
    itemsScraped: integer("items_scraped").default(0),
    errorMessage: text("error_message"),
    startedAt: integer("started_at", { mode: "timestamp" }),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => [
    index("idx_scrape_jobs_status").on(table.status),
    index("idx_scrape_jobs_job_type").on(table.jobType),
  ]
);

export const prompts = sqliteTable(
  "prompts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    body: text("body").notNull(),
    kind: text("kind", { enum: ["generate", "cleanup"] }).notNull().default("generate"),
    previousBody: text("previous_body"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => [index("idx_prompts_name").on(table.name), index("idx_prompts_kind").on(table.kind)]
);

export const generations = sqliteTable(
  "generations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    artistId: integer("artist_id")
      .notNull()
      .references(() => artists.id),
    promptId: integer("prompt_id").references(() => prompts.id),
    promptName: text("prompt_name"),
    output: text("output").notNull().default(""),
    originalOutput: text("original_output").notNull().default(""),
    model: text("model"),
    status: text("status", { enum: ["running", "done", "failed"] }).default("done"),
    errorMessage: text("error_message"),
    readyToSendAt: integer("ready_to_send_at", { mode: "timestamp" }),
    sentAt: integer("sent_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => [
    index("idx_generations_artist").on(table.artistId),
    index("idx_generations_prompt").on(table.promptId),
  ]
);

// Relations
export const artistsRelations = relations(artists, ({ many }) => ({
  posts: many(posts),
  generations: many(generations),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  artist: one(artists, { fields: [posts.artistId], references: [artists.id] }),
  images: many(images),
  hashtags: many(postHashtags),
}));

export const imagesRelations = relations(images, ({ one }) => ({
  post: one(posts, { fields: [images.postId], references: [posts.id] }),
}));

export const hashtagsRelations = relations(hashtags, ({ many }) => ({
  posts: many(postHashtags),
}));

export const postHashtagsRelations = relations(postHashtags, ({ one }) => ({
  post: one(posts, { fields: [postHashtags.postId], references: [posts.id] }),
  hashtag: one(hashtags, { fields: [postHashtags.hashtagId], references: [hashtags.id] }),
}));

export const promptsRelations = relations(prompts, ({ many }) => ({
  generations: many(generations),
}));

export const generationsRelations = relations(generations, ({ one }) => ({
  artist: one(artists, { fields: [generations.artistId], references: [artists.id] }),
  prompt: one(prompts, { fields: [generations.promptId], references: [prompts.id] }),
}));

export type Artist = typeof artists.$inferSelect;
export type NewArtist = typeof artists.$inferInsert;
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type Image = typeof images.$inferSelect;
export type NewImage = typeof images.$inferInsert;
export type Hashtag = typeof hashtags.$inferSelect;
export type NewHashtag = typeof hashtags.$inferInsert;
export type ScrapeJob = typeof scrapeJobs.$inferSelect;
export type NewScrapeJob = typeof scrapeJobs.$inferInsert;
export type Prompt = typeof prompts.$inferSelect;
export type NewPrompt = typeof prompts.$inferInsert;
export type Generation = typeof generations.$inferSelect;
export type NewGeneration = typeof generations.$inferInsert;
