import * as cloud from "../cloud/client";

export interface ArtistData {
  username: string;
  fullName?: string;
  bio?: string;
  followersCount?: number;
  followingCount?: number;
  postsCount?: number;
  profilePicUrl?: string;
  isVerified?: boolean;
}

export async function saveArtist(data: ArtistData) {
  const result = await cloud.artists.upsert({
    username: data.username,
    fullName: data.fullName,
    bio: data.bio,
    followersCount: data.followersCount,
    followingCount: data.followingCount,
    postsCount: data.postsCount,
    profilePicUrl: data.profilePicUrl,
    isVerified: data.isVerified,
  });
  console.log(`Artist saved: @${data.username} (ID: ${result.id})`);
  return result;
}

export async function handleSaveArtist(jsonData: string) {
  try {
    const data: ArtistData = JSON.parse(jsonData);
    const result = await saveArtist(data);
    console.log(JSON.stringify({ success: true, id: result.id }));
    return result;
  } catch (error) {
    console.error("Failed to save artist:", error);
    process.exit(1);
  }
}
