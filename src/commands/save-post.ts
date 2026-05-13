import * as cloud from "../cloud/client";

export interface PostData {
  shortcode: string;
  instagramId?: string;
  artistUsername: string;
  caption?: string;
  likesCount?: number;
  commentsCount?: number;
  postType?: "image" | "video" | "carousel";
  postedAt?: string;
  imageUrls?: string[];
  hashtags?: string[];
}

const HASHTAG_RE = /#([\p{L}\p{N}_]+)/gu;

function extractHashtags(caption: string | undefined): string[] {
  if (!caption) return [];
  const seen = new Set<string>();
  for (const m of caption.matchAll(HASHTAG_RE)) {
    seen.add(m[1].toLowerCase());
  }
  return Array.from(seen);
}

export async function savePost(data: PostData) {
  // Ensure artist row exists in cloud first (scrape-post skill always upserts artist before posts).
  let artist = await cloud.artists.get(data.artistUsername).catch(() => null);
  if (!artist) {
    artist = await cloud.artists.upsert({ username: data.artistUsername });
  }

  const explicit = (data.hashtags ?? []).map((t) => t.replace(/^#/, "").toLowerCase());
  const merged = Array.from(new Set([...explicit, ...extractHashtags(data.caption)]));

  const post = await cloud.posts.upsert({
    artistUsername: data.artistUsername,
    shortcode: data.shortcode,
    instagramId: data.instagramId,
    caption: data.caption,
    likesCount: data.likesCount,
    commentsCount: data.commentsCount,
    postType: data.postType || "image",
    postedAt: data.postedAt,
    // Worker inserts images + links hashtags atomically with the post upsert.
    images: (data.imageUrls ?? []).map((url) => ({ url })),
    hashtags: merged,
  });

  console.log(`Post saved: ${data.shortcode} (ID: ${post.id})`);
  return post;
}

export async function handleSavePost(jsonData: string) {
  try {
    const data: PostData = JSON.parse(jsonData);
    const result = await savePost(data);
    console.log(JSON.stringify({ success: true, id: result.id }));
    return result;
  } catch (error) {
    console.error("Failed to save post:", error);
    process.exit(1);
  }
}
