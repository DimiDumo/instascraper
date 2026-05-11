CREATE TABLE `artists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`full_name` text,
	`bio` text,
	`followers_count` integer,
	`following_count` integer,
	`posts_count` integer,
	`profile_pic_url` text,
	`profile_pic_key` text,
	`is_verified` integer DEFAULT false,
	`scraped_at` integer,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `artists_username_unique` ON `artists` (`username`);--> statement-breakpoint
CREATE INDEX `idx_artists_username` ON `artists` (`username`);--> statement-breakpoint
CREATE TABLE `generations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`artist_id` integer NOT NULL,
	`prompt_id` integer,
	`prompt_name` text,
	`output` text DEFAULT '' NOT NULL,
	`original_output` text DEFAULT '' NOT NULL,
	`model` text,
	`status` text DEFAULT 'done',
	`error_message` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`artist_id`) REFERENCES `artists`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`prompt_id`) REFERENCES `prompts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_generations_artist` ON `generations` (`artist_id`);--> statement-breakpoint
CREATE INDEX `idx_generations_prompt` ON `generations` (`prompt_id`);--> statement-breakpoint
CREATE TABLE `hashtags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`posts_count` integer,
	`last_scraped_at` integer,
	`is_tracked` integer DEFAULT false,
	`priority` integer DEFAULT 0,
	`created_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hashtags_name_unique` ON `hashtags` (`name`);--> statement-breakpoint
CREATE INDEX `idx_hashtags_name` ON `hashtags` (`name`);--> statement-breakpoint
CREATE INDEX `idx_hashtags_is_tracked` ON `hashtags` (`is_tracked`);--> statement-breakpoint
CREATE TABLE `images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_id` integer NOT NULL,
	`url` text NOT NULL,
	`r2_key` text,
	`width` integer,
	`height` integer,
	`downloaded_at` integer,
	`created_at` integer,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_images_post_id` ON `images` (`post_id`);--> statement-breakpoint
CREATE TABLE `post_hashtags` (
	`post_id` integer NOT NULL,
	`hashtag_id` integer NOT NULL,
	PRIMARY KEY(`post_id`, `hashtag_id`),
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`hashtag_id`) REFERENCES `hashtags`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_post_hashtags_post_id` ON `post_hashtags` (`post_id`);--> statement-breakpoint
CREATE INDEX `idx_post_hashtags_hashtag_id` ON `post_hashtags` (`hashtag_id`);--> statement-breakpoint
CREATE TABLE `posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`instagram_id` text,
	`artist_id` integer,
	`shortcode` text NOT NULL,
	`caption` text,
	`likes_count` integer,
	`comments_count` integer,
	`post_type` text DEFAULT 'image',
	`image_key` text,
	`posted_at` integer,
	`scraped_at` integer,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`artist_id`) REFERENCES `artists`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `posts_instagram_id_unique` ON `posts` (`instagram_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `posts_shortcode_unique` ON `posts` (`shortcode`);--> statement-breakpoint
CREATE INDEX `idx_posts_shortcode` ON `posts` (`shortcode`);--> statement-breakpoint
CREATE INDEX `idx_posts_artist_id` ON `posts` (`artist_id`);--> statement-breakpoint
CREATE TABLE `prompts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`body` text NOT NULL,
	`kind` text DEFAULT 'generate' NOT NULL,
	`previous_body` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_prompts_name` ON `prompts` (`name`);--> statement-breakpoint
CREATE INDEX `idx_prompts_kind` ON `prompts` (`kind`);--> statement-breakpoint
CREATE TABLE `scrape_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_type` text NOT NULL,
	`target` text NOT NULL,
	`status` text DEFAULT 'pending',
	`items_scraped` integer DEFAULT 0,
	`error_message` text,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_scrape_jobs_status` ON `scrape_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `idx_scrape_jobs_job_type` ON `scrape_jobs` (`job_type`);