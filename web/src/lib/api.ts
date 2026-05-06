export interface Artist {
  id: number;
  username: string;
  fullName: string | null;
  bio: string | null;
  followersCount: number | null;
  followingCount: number | null;
  postsCount: number | null;
  profilePicLocalPath: string | null;
  profilePicUrl: string | null;
  isVerified: boolean | null;
  scrapedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface Image {
  id: number;
  url: string;
  localPath: string | null;
  width: number | null;
  height: number | null;
  downloadedAt: string | null;
}

export interface Post {
  id: number;
  shortcode: string;
  caption: string | null;
  likesCount: number | null;
  commentsCount: number | null;
  postType: "image" | "video" | "carousel" | null;
  imageLocalPath: string | null;
  postedAt: string | null;
  scrapedAt: string | null;
  images: Image[];
}

export interface ArtistDetail extends Artist {
  posts: Post[];
}

export interface Tag {
  id: number;
  name: string;
  postsCount: number | null;
  lastScrapedAt: string | null;
  isTracked: boolean;
  priority: number;
  linkedPosts: number;
}

export interface Job {
  id: number;
  jobType: "hashtag" | "artist";
  target: string;
  status: "pending" | "running" | "completed" | "failed";
  itemsScraped: number | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string | null;
}

export interface QueueState {
  running: { jobId: number; jobType: string; target: string } | null;
  pending: Array<{ jobId: number; jobType: string; target: string }>;
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listArtists: (
    params: {
      limit?: number;
      offset?: number;
      search?: string;
      minFollowers?: number;
      maxFollowers?: number;
    } = {}
  ) => {
    const q = new URLSearchParams();
    if (params.limit) q.set("limit", String(params.limit));
    if (params.offset) q.set("offset", String(params.offset));
    if (params.search) q.set("search", params.search);
    if (typeof params.minFollowers === "number") q.set("minFollowers", String(params.minFollowers));
    if (typeof params.maxFollowers === "number") q.set("maxFollowers", String(params.maxFollowers));
    return jsonFetch<{ rows: Artist[]; total: number }>(`/api/artists?${q}`);
  },
  getArtist: (username: string) => jsonFetch<ArtistDetail>(`/api/artists/${username}`),
  listTags: () => jsonFetch<{ rows: Tag[] }>(`/api/tags`),
  setTagTracked: (name: string, isTracked: boolean, priority?: number) =>
    jsonFetch<Tag>(`/api/tags/${encodeURIComponent(name)}`, {
      method: "PATCH",
      body: JSON.stringify({ isTracked, priority }),
    }),
  createTag: (name: string, isTracked = true) =>
    jsonFetch<Tag>(`/api/tags`, {
      method: "POST",
      body: JSON.stringify({ name, isTracked }),
    }),
  deleteTag: (name: string) =>
    jsonFetch<{ ok: true }>(`/api/tags/${encodeURIComponent(name)}`, { method: "DELETE" }),
  listJobs: () =>
    jsonFetch<{ rows: Job[]; queue: QueueState }>(`/api/jobs`),
  getJobLogs: (jobId: number) =>
    jsonFetch<{ jobId: number; lines: Array<{ ts: number; stream: "stdout" | "stderr" | "system"; line: string }> }>(
      `/api/logs/${jobId}`
    ),
  scrapeHashtag: (hashtag: string) =>
    jsonFetch<Job>(`/api/jobs/scrape-hashtag`, {
      method: "POST",
      body: JSON.stringify({ hashtag }),
    }),
  scrapeArtist: (username: string) =>
    jsonFetch<Job>(`/api/jobs/scrape-artist`, {
      method: "POST",
      body: JSON.stringify({ username }),
    }),
  runTracked: () =>
    jsonFetch<{ enqueued: Job[] }>(`/api/jobs/run-tracked`, { method: "POST" }),
  cancelJob: (jobId: number) =>
    jsonFetch<{ ok: true; killed: boolean }>(`/api/jobs/${jobId}/cancel`, { method: "POST" }),
};

/** Convert local image path on disk (data/images/...) to /images/... URL. */
export function imageUrl(localPath: string | null | undefined): string | undefined {
  if (!localPath) return undefined;
  // localPath is stored as "./data/images/<user>/<file>" or "data/images/<user>/<file>".
  const m = localPath.match(/data\/images\/(.+)$/);
  if (m) return `/images/${m[1]}`;
  return localPath.startsWith("/") ? localPath : `/images/${localPath}`;
}

export function relTime(iso: string | null | undefined): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "just now";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}
