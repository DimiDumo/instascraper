import * as cloud from "../cloud/client";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export interface RejectedData {
  username: string;
  reason: "out_of_range" | "low_score" | "manual_review";
  score?: number;
  followersCount?: number;
  primaryReason?: string;
  sourceHashtag?: string;
}

// Prints one JSON line the scraper skills parse to decide whether to scrape.
// Hashtag discovery skips anything with seen:true. Explicit artist scrapes may
// refresh a scraped artist only when shouldRefresh is true (stale + not sent).
export async function handleCheckArtist(username: string) {
  try {
    const res = await cloud.artists.seen(username);

    if (res.status === "new") {
      console.log(JSON.stringify({ seen: false, status: "new" }));
      return;
    }

    if (res.status === "rejected") {
      console.log(
        JSON.stringify({
          seen: true,
          status: "rejected",
          rejectReason: res.rejected?.reason ?? null,
          shouldRefresh: false,
        }),
      );
      return;
    }

    // status === "scraped"
    const scrapedAtRaw = res.artist?.scrapedAt ?? null;
    const scrapedAtMs = scrapedAtRaw ? new Date(scrapedAtRaw).getTime() : 0;
    const stale = Date.now() - scrapedAtMs > NINETY_DAYS_MS;
    const shouldRefresh = res.dmStatus !== "sent" && stale;
    console.log(
      JSON.stringify({
        seen: true,
        status: "scraped",
        scrapedAt: scrapedAtRaw,
        dmStatus: res.dmStatus ?? "none",
        shouldRefresh,
      }),
    );
  } catch (error) {
    console.error("Failed to check artist:", error);
    process.exit(1);
  }
}

export async function handleSaveRejected(jsonData: string) {
  try {
    const data: RejectedData = JSON.parse(jsonData);
    const result = await cloud.artists.reject({
      username: data.username,
      reason: data.reason,
      score: data.score,
      followersCount: data.followersCount,
      primaryReason: data.primaryReason,
      sourceHashtag: data.sourceHashtag,
    });
    console.log(
      JSON.stringify({ success: true, id: result.id, username: data.username, reason: data.reason }),
    );
    return result;
  } catch (error) {
    console.error("Failed to save rejected artist:", error);
    process.exit(1);
  }
}
