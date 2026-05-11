// Local-side R2 uploader. Used by the scraper to push freshly downloaded
// image bytes straight to R2 (no Worker hop). Reads happen through the Worker's
// /api/images/<key> route so CF Access can gate them.

import { AwsClient } from "aws4fetch";

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID ?? "";
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID ?? "";
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY ?? "";
const BUCKET = process.env.R2_BUCKET ?? "instascraper-images";

const endpoint = ACCOUNT_ID ? `https://${ACCOUNT_ID}.r2.cloudflarestorage.com` : "";

const client = ACCESS_KEY && SECRET_KEY
  ? new AwsClient({
      accessKeyId: ACCESS_KEY,
      secretAccessKey: SECRET_KEY,
      service: "s3",
      region: "auto",
    })
  : null;

function assertConfigured() {
  if (!client || !endpoint) {
    throw new Error(
      "R2 not configured — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY in .env",
    );
  }
}

export function r2KeyForPost(username: string, shortcode: string, index: number, ext = "jpg") {
  return `${username}/${shortcode}_${index}.${ext}`;
}

export function r2KeyForProfilePic(username: string, ext = "jpg") {
  return `${username}/profile.${ext}`;
}

export async function uploadBytes(
  key: string,
  bytes: ArrayBuffer | Uint8Array | Blob,
  contentType = "image/jpeg",
): Promise<{ key: string }> {
  assertConfigured();
  const url = `${endpoint}/${BUCKET}/${key}`;
  const res = await client!.fetch(url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: bytes as any,
  });
  if (!res.ok) {
    throw new Error(`R2 PUT ${key} → ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return { key };
}

// Fetch an R2 object's bytes (signed GET via S3 API). Used by local generation
// flows that need to pass images to the agent subprocess via Read tool — we
// stash them in /tmp first.
export async function downloadBytes(key: string): Promise<ArrayBuffer> {
  assertConfigured();
  const url = `${endpoint}/${BUCKET}/${key}`;
  const res = await client!.fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`R2 GET ${key} → ${res.status}`);
  return res.arrayBuffer();
}

import { mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";

const TMP_ROOT = join(tmpdir(), "instascraper-cache");

export async function downloadToTmp(key: string): Promise<string> {
  const dest = join(TMP_ROOT, key);
  await mkdir(dirname(dest), { recursive: true });
  // Cheap cache: if already on disk, reuse it.
  const existing = Bun.file(dest);
  if (await existing.exists()) return dest;
  const buf = await downloadBytes(key);
  await Bun.write(dest, buf);
  return dest;
}

// Convenience: fetch a public CDN URL then PUT to R2 under the canonical key.
export async function uploadFromUrl(
  url: string,
  key: string,
  contentType = "image/jpeg",
): Promise<{ key: string; bytes: number }> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch ${url} → ${r.status}`);
  const buf = await r.arrayBuffer();
  await uploadBytes(key, buf, r.headers.get("content-type") ?? contentType);
  return { key, bytes: buf.byteLength };
}
