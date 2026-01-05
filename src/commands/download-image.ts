import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { updateImageLocalPath, getImagesByPost, getPostByShortcode } from "../db";

const IMAGE_DIR = process.env.IMAGE_DIR || "./data/images";

export interface DownloadOptions {
  url: string;
  postId?: number;
  shortcode?: string;
  artistUsername: string;
  index?: number;
}

export async function downloadImage(options: DownloadOptions): Promise<string> {
  const { url, artistUsername, index = 0 } = options;

  // Determine the shortcode
  let shortcode = options.shortcode;
  if (!shortcode && options.postId) {
    shortcode = `post_${options.postId}`;
  }

  // Create directory structure: data/images/{username}/
  const artistDir = join(IMAGE_DIR, artistUsername);
  await mkdir(artistDir, { recursive: true });

  // Generate filename
  const extension = getExtensionFromUrl(url);
  const filename = `${shortcode}_${index}${extension}`;
  const localPath = join(artistDir, filename);

  // Download the image
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    await Bun.write(localPath, buffer);

    console.log(`Downloaded: ${localPath}`);
    return localPath;
  } catch (error) {
    console.error(`Failed to download ${url}:`, error);
    throw error;
  }
}

export async function downloadPostImages(
  shortcode: string,
  artistUsername: string
): Promise<string[]> {
  const post = getPostByShortcode(shortcode);
  if (!post) {
    throw new Error(`Post not found: ${shortcode}`);
  }

  const images = getImagesByPost(post.id);
  const downloadedPaths: string[] = [];

  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    if (image.downloadedAt) {
      console.log(`Skipping already downloaded: ${image.localPath}`);
      continue;
    }

    const localPath = await downloadImage({
      url: image.url,
      shortcode,
      artistUsername,
      index: i,
    });

    updateImageLocalPath(image.id, localPath);
    downloadedPaths.push(localPath);
  }

  return downloadedPaths;
}

function getExtensionFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const match = pathname.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    return match ? `.${match[1].toLowerCase()}` : ".jpg";
  } catch {
    return ".jpg";
  }
}

// CLI handler for single image download
export async function handleDownloadImage(
  url: string,
  artistUsername: string,
  shortcode: string,
  index: string = "0"
) {
  try {
    const localPath = await downloadImage({
      url,
      artistUsername,
      shortcode,
      index: parseInt(index, 10),
    });
    console.log(JSON.stringify({ success: true, localPath }));
    return localPath;
  } catch (error) {
    console.error("Failed to download image:", error);
    process.exit(1);
  }
}

// CLI handler for downloading all images for a post
export async function handleDownloadPostImages(
  shortcode: string,
  artistUsername: string
) {
  try {
    const paths = await downloadPostImages(shortcode, artistUsername);
    console.log(JSON.stringify({ success: true, count: paths.length, paths }));
    return paths;
  } catch (error) {
    console.error("Failed to download post images:", error);
    process.exit(1);
  }
}

// Move image from Downloads folder to organized directory
export async function moveFromDownloads(
  filename: string,
  artistUsername: string,
  shortcode: string,
  index: number = 0
): Promise<string> {
  const downloadsDir = join(process.env.HOME || "~", "Downloads");
  const sourcePath = join(downloadsDir, filename);

  const artistDir = join(IMAGE_DIR, artistUsername);
  await mkdir(artistDir, { recursive: true });

  // Determine extension from source file
  const ext = filename.split(".").pop() || "jpg";
  const destFilename = `${shortcode}_${index}.${ext}`;
  const localPath = join(artistDir, destFilename);

  // Read source and write to destination
  const file = Bun.file(sourcePath);
  if (!await file.exists()) {
    throw new Error(`File not found: ${sourcePath}`);
  }

  const buffer = await file.arrayBuffer();
  await Bun.write(localPath, buffer);

  // Delete source file
  await Bun.write(sourcePath, "").then(() => {
    require("fs").unlinkSync(sourcePath);
  }).catch(() => {});

  console.log(`Image saved: ${localPath}`);
  return localPath;
}

// CLI handler for moving image from Downloads
export async function handleMoveFromDownloads(
  filename: string,
  artistUsername: string,
  shortcode: string,
  index: string = "0"
) {
  try {
    const localPath = await moveFromDownloads(
      filename,
      artistUsername,
      shortcode,
      parseInt(index, 10)
    );
    console.log(JSON.stringify({ success: true, localPath }));
    return localPath;
  } catch (error) {
    console.error("Failed to move image:", error);
    process.exit(1);
  }
}

// Copy/move a screenshot file to the organized directory
export async function saveScreenshot(
  sourcePath: string,
  artistUsername: string,
  shortcode: string,
  index: number = 0
): Promise<string> {
  const artistDir = join(IMAGE_DIR, artistUsername);
  await mkdir(artistDir, { recursive: true });

  // Determine extension from source file
  const ext = sourcePath.split(".").pop() || "png";
  const filename = `${shortcode}_${index}.${ext}`;
  const localPath = join(artistDir, filename);

  // Read source and write to destination
  const file = Bun.file(sourcePath);
  const buffer = await file.arrayBuffer();
  await Bun.write(localPath, buffer);

  console.log(`Screenshot saved: ${localPath}`);
  return localPath;
}

// CLI handler for saving a screenshot (copies from source path)
export async function handleSaveScreenshot(
  sourcePath: string,
  artistUsername: string,
  shortcode: string,
  index: string = "0"
) {
  try {
    const localPath = await saveScreenshot(
      sourcePath,
      artistUsername,
      shortcode,
      parseInt(index, 10)
    );
    console.log(JSON.stringify({ success: true, localPath }));
    return localPath;
  } catch (error) {
    console.error("Failed to save screenshot:", error);
    process.exit(1);
  }
}
