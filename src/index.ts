#!/usr/bin/env bun
import { Command } from "commander";
import { handleSaveArtist } from "./commands/save-artist";
import { handleSavePost } from "./commands/save-post";
import { handleUploadImage } from "./commands/download-image";
import {
  handleCreateJob,
  handleStartJob,
  handleCompleteJob,
  handleFailJob,
  handleUpdateProgress,
  handleListJobs,
  handleGetJob,
  handleNextJob,
  handlePendingCount,
} from "./commands/job-status";

const program = new Command();

program
  .name("instascraper")
  .description("Instagram scraper CLI — pushes data to Cloudflare D1/R2 via Worker API")
  .version("2.0.0");

// Database commands
const dbCmd = program.command("db").description("Cloud data operations (D1 via Worker)");

dbCmd
  .command("save-artist")
  .description("Save or update an artist")
  .argument("<json>", "Artist data as JSON string")
  .action(async (json) => {
    await handleSaveArtist(json);
  });

dbCmd
  .command("save-post")
  .description("Save or update a post with images and hashtags")
  .argument("<json>", "Post data as JSON string")
  .action(async (json) => {
    await handleSavePost(json);
  });

// Image commands
const imagesCmd = program.command("images").description("Image operations (R2)");

imagesCmd
  .command("upload")
  .description("Download an image from a URL and upload to R2 under <username>/<shortcode>_<index>.<ext>")
  .requiredOption("-u, --url <url>", "Source image URL (Instagram CDN)")
  .requiredOption("-a, --artist <username>", "Artist username")
  .requiredOption("-s, --shortcode <code>", "Post shortcode, or 'profile' for the profile pic")
  .option("-i, --index <number>", "Image index", "0")
  .action(async (options) => {
    await handleUploadImage(options.url, options.artist, options.shortcode, options.index);
  });

// Job commands
const jobCmd = program.command("job").description("Job management");

jobCmd
  .command("create")
  .description("Create a new scrape job")
  .argument("<type>", "Job type: hashtag or artist")
  .argument("<target>", "Target hashtag name or username")
  .action(async (type, target) => {
    await handleCreateJob(type, target);
  });

jobCmd
  .command("start")
  .description("Mark a job as started")
  .argument("<id>", "Job ID")
  .action(async (id) => {
    await handleStartJob(id);
  });

jobCmd
  .command("complete")
  .description("Mark a job as completed")
  .argument("<id>", "Job ID")
  .argument("<count>", "Number of items scraped")
  .action(async (id, count) => {
    await handleCompleteJob(id, count);
  });

jobCmd
  .command("fail")
  .description("Mark a job as failed")
  .argument("<id>", "Job ID")
  .argument("<error>", "Error message")
  .action(async (id, error) => {
    await handleFailJob(id, error);
  });

jobCmd
  .command("progress")
  .description("Update job progress")
  .argument("<id>", "Job ID")
  .argument("<count>", "Current items scraped")
  .action(async (id, count) => {
    await handleUpdateProgress(id, count);
  });

jobCmd
  .command("list")
  .description("List recent jobs")
  .action(async () => {
    await handleListJobs();
  });

jobCmd
  .command("get")
  .description("Get job details")
  .argument("<id>", "Job ID")
  .action(async (id) => {
    await handleGetJob(id);
  });

jobCmd
  .command("next")
  .description("Claim the next pending job (sets status=running) and print as JSON")
  .action(async () => {
    await handleNextJob();
  });

jobCmd
  .command("pending")
  .description("Print count of pending jobs as JSON")
  .action(async () => {
    await handlePendingCount();
  });

program.parseAsync();
