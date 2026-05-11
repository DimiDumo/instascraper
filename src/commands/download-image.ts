import * as cloud from "../cloud/client";
import { r2KeyForPost, r2KeyForProfilePic, uploadFromUrl } from "../cloud/r2";

export interface UploadOptions {
  url: string;
  artistUsername: string;
  shortcode: string;
  index?: number;
}

function extFromUrl(url: string): string {
  try {
    const m = new URL(url).pathname.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    return m ? m[1]!.toLowerCase() : "jpg";
  } catch {
    return "jpg";
  }
}

/**
 * Download an image from its CDN URL and upload to R2 under the canonical key
 * (`<username>/<shortcode>_<index>.<ext>` or `<username>/profile.<ext>`). Updates
 * the cloud DB so the row has the R2 key.
 */
export async function uploadImage(opts: UploadOptions): Promise<string> {
  const { url, artistUsername, shortcode, index = 0 } = opts;
  const ext = extFromUrl(url);
  const key =
    shortcode === "profile"
      ? r2KeyForProfilePic(artistUsername, ext)
      : r2KeyForPost(artistUsername, shortcode, index, ext);

  await uploadFromUrl(url, key);

  if (shortcode === "profile") {
    await cloud.artists.setProfilePicKey(artistUsername, key);
  } else {
    // The single representative image for the post — used as thumbnail in the UI.
    await cloud.posts.setImageKey(shortcode, key);
  }
  console.log(`Uploaded: ${key}`);
  return key;
}

export async function handleUploadImage(
  url: string,
  artistUsername: string,
  shortcode: string,
  index: string = "0",
) {
  try {
    const key = await uploadImage({
      url,
      artistUsername,
      shortcode,
      index: parseInt(index, 10),
    });
    console.log(JSON.stringify({ success: true, key }));
    return key;
  } catch (error) {
    console.error("Failed to upload image:", error);
    process.exit(1);
  }
}
