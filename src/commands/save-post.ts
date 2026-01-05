import {
  upsertPost,
  insertImage,
  getArtistByUsername,
  upsertArtist,
  upsertHashtag,
  linkPostToHashtag,
  type NewPost,
  type NewImage,
} from "../db";

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

export function savePost(data: PostData) {
  // First, ensure the artist exists
  let artist = getArtistByUsername(data.artistUsername);
  if (!artist) {
    artist = upsertArtist({ username: data.artistUsername });
  }

  // Save the post
  const postData: NewPost = {
    shortcode: data.shortcode,
    instagramId: data.instagramId,
    artistId: artist.id,
    caption: data.caption,
    likesCount: data.likesCount,
    commentsCount: data.commentsCount,
    postType: data.postType || "image",
    postedAt: data.postedAt ? new Date(data.postedAt) : undefined,
  };

  const post = upsertPost(postData);
  console.log(`Post saved: ${data.shortcode} (ID: ${post.id})`);

  // Save images
  if (data.imageUrls && data.imageUrls.length > 0) {
    for (const url of data.imageUrls) {
      const imageData: NewImage = {
        postId: post.id!,
        url,
      };
      insertImage(imageData);
    }
    console.log(`Saved ${data.imageUrls.length} image(s)`);
  }

  // Save hashtags and link them
  if (data.hashtags && data.hashtags.length > 0) {
    for (const tagName of data.hashtags) {
      const cleanName = tagName.replace(/^#/, "").toLowerCase();
      const hashtag = upsertHashtag({ name: cleanName });
      linkPostToHashtag(post.id!, hashtag.id!);
    }
    console.log(`Linked ${data.hashtags.length} hashtag(s)`);
  }

  return post;
}

// CLI handler
export function handleSavePost(jsonData: string) {
  try {
    const data: PostData = JSON.parse(jsonData);
    const result = savePost(data);
    console.log(JSON.stringify({ success: true, id: result.id }));
    return result;
  } catch (error) {
    console.error("Failed to save post:", error);
    process.exit(1);
  }
}
