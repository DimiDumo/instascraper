#!/usr/bin/env bun
import { Command } from "commander";
import { checkConnection, closeConnection, updatePostImagePath } from "./db";
import { handleSaveArtist } from "./commands/save-artist";
import { handleSavePost } from "./commands/save-post";
import {
  handleDownloadImage,
  handleDownloadPostImages,
  handleSaveScreenshot,
  handleMoveFromDownloads,
} from "./commands/download-image";
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
  .description("Instagram scraper CLI for data management")
  .version("1.0.0");

// Database commands
const dbCmd = program.command("db").description("Database operations");

dbCmd
  .command("check")
  .description("Check database connection")
  .action(() => {
    const connected = checkConnection();
    if (connected) {
      console.log("Database connection OK");
    } else {
      console.error("Database connection FAILED");
      process.exit(1);
    }
    closeConnection();
  });

dbCmd
  .command("save-artist")
  .description("Save or update an artist")
  .argument("<json>", "Artist data as JSON string")
  .action((json) => {
    handleSaveArtist(json);
    closeConnection();
  });

dbCmd
  .command("save-post")
  .description("Save or update a post with images and hashtags")
  .argument("<json>", "Post data as JSON string")
  .action((json) => {
    handleSavePost(json);
    closeConnection();
  });

dbCmd
  .command("update-post-image")
  .description("Update the local image path for a post")
  .argument("<shortcode>", "Post shortcode")
  .argument("<path>", "Local image path")
  .action((shortcode, path) => {
    updatePostImagePath(shortcode, path);
    console.log(`Updated image path for ${shortcode}: ${path}`);
    closeConnection();
  });

// Image commands
const imagesCmd = program.command("images").description("Image operations");

imagesCmd
  .command("download")
  .description("Download a single image")
  .requiredOption("-u, --url <url>", "Image URL")
  .requiredOption("-a, --artist <username>", "Artist username")
  .requiredOption("-s, --shortcode <code>", "Post shortcode")
  .option("-i, --index <number>", "Image index", "0")
  .action(async (options) => {
    await handleDownloadImage(
      options.url,
      options.artist,
      options.shortcode,
      options.index
    );
    closeConnection();
  });

imagesCmd
  .command("download-post")
  .description("Download all images for a post")
  .argument("<shortcode>", "Post shortcode")
  .argument("<artist>", "Artist username")
  .action(async (shortcode, artist) => {
    await handleDownloadPostImages(shortcode, artist);
    closeConnection();
  });

imagesCmd
  .command("save-screenshot")
  .description("Save a screenshot to the organized directory")
  .requiredOption("-f, --file <path>", "Source screenshot file path")
  .requiredOption("-a, --artist <username>", "Artist username")
  .requiredOption("-s, --shortcode <code>", "Post shortcode")
  .option("-i, --index <number>", "Image index", "0")
  .action(async (options) => {
    await handleSaveScreenshot(
      options.file,
      options.artist,
      options.shortcode,
      options.index
    );
    closeConnection();
  });

imagesCmd
  .command("move-download")
  .description("Move an image from Downloads folder to organized directory")
  .requiredOption("-f, --filename <name>", "Filename in Downloads folder")
  .requiredOption("-a, --artist <username>", "Artist username")
  .requiredOption("-s, --shortcode <code>", "Post shortcode")
  .option("-i, --index <number>", "Image index", "0")
  .action(async (options) => {
    await handleMoveFromDownloads(
      options.filename,
      options.artist,
      options.shortcode,
      options.index
    );
    closeConnection();
  });

// Job commands
const jobCmd = program.command("job").description("Job management");

jobCmd
  .command("create")
  .description("Create a new scrape job")
  .argument("<type>", "Job type: hashtag or artist")
  .argument("<target>", "Target hashtag name or username")
  .action((type, target) => {
    handleCreateJob(type, target);
    closeConnection();
  });

jobCmd
  .command("start")
  .description("Mark a job as started")
  .argument("<id>", "Job ID")
  .action((id) => {
    handleStartJob(id);
    closeConnection();
  });

jobCmd
  .command("complete")
  .description("Mark a job as completed")
  .argument("<id>", "Job ID")
  .argument("<count>", "Number of items scraped")
  .action((id, count) => {
    handleCompleteJob(id, count);
    closeConnection();
  });

jobCmd
  .command("fail")
  .description("Mark a job as failed")
  .argument("<id>", "Job ID")
  .argument("<error>", "Error message")
  .action((id, error) => {
    handleFailJob(id, error);
    closeConnection();
  });

jobCmd
  .command("progress")
  .description("Update job progress")
  .argument("<id>", "Job ID")
  .argument("<count>", "Current items scraped")
  .action((id, count) => {
    handleUpdateProgress(id, count);
    closeConnection();
  });

jobCmd
  .command("list")
  .description("List recent jobs")
  .action(() => {
    handleListJobs();
    closeConnection();
  });

jobCmd
  .command("get")
  .description("Get job details")
  .argument("<id>", "Job ID")
  .action((id) => {
    handleGetJob(id);
    closeConnection();
  });

jobCmd
  .command("next")
  .description("Claim the next pending job (sets status=running) and print as JSON")
  .action(() => {
    handleNextJob();
    closeConnection();
  });

jobCmd
  .command("pending")
  .description("Print count of pending jobs as JSON")
  .action(() => {
    handlePendingCount();
    closeConnection();
  });

// Parse and execute
program.parse();
