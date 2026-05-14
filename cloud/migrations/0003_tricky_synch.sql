CREATE TABLE `rejected_artists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`reason` text NOT NULL,
	`score` integer,
	`followers_count` integer,
	`primary_reason` text,
	`source_hashtag` text,
	`evaluated_at` integer,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rejected_artists_username_unique` ON `rejected_artists` (`username`);--> statement-breakpoint
CREATE INDEX `idx_rejected_artists_username` ON `rejected_artists` (`username`);