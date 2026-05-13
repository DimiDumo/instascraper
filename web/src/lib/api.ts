// Cloud calls go to a relative `/api/*` path:
//   - In dev (vite at localhost:5173), vite.config.ts proxies it to the cloud
//     Worker and injects the CF Access Service Token headers so preflight
//     succeeds without a CF Access cookie.
//   - In prod, the web app is served from reo.gallerytalk.io and the Worker is
//     routed to /api/* on the same host — same-origin, no CORS, browser cookie
//     auth.
//
// Local orchestration calls (scrape kick-off, generations POST, refine, queue,
// logs, SSE) always go to the absolute localhost server when reachable.

const CLOUD_API = ""; // relative
const LOCAL_API = (import.meta.env.VITE_LOCAL_API_URL as string | undefined)?.replace(/\/$/, "") ?? "http://localhost:3737";

export type DmStatus = "none" | "draft" | "synced" | "ready" | "sent";

export interface Artist {
  id: number;
  username: string;
  fullName: string | null;
  bio: string | null;
  followersCount: number | null;
  followingCount: number | null;
  postsCount: number | null;
  profilePicKey: string | null;
  profilePicUrl: string | null;
  isVerified: boolean | null;
  scrapedAt: string | null;
  hubspotContactId: string | null;
  hubspotSyncedAt: string | null;
  dmStatus: DmStatus;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface HubSpotSyncResult {
  hubspotContactId: string;
  hubspotSyncedAt: string;
  hasDm: boolean;
}

export interface Image {
  id: number;
  url: string;
  r2Key: string | null;
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
  imageKey: string | null;
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

export type PromptKind = "generate" | "cleanup";

export interface Prompt {
  id: number;
  name: string;
  body: string;
  kind: PromptKind;
  previousBody: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface Generation {
  id: number;
  artistId: number;
  promptId: number | null;
  promptName: string | null;
  output: string;
  originalOutput: string;
  model: string | null;
  status: "running" | "done" | "failed";
  errorMessage: string | null;
  readyToSendAt: string | null;
  sentAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface MarkSentResult {
  generationId: number;
  sentAt: string;
  leadStatus: "updated" | "skipped";
  noteId: string;
}

async function cloudFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CLOUD_API}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function localFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${LOCAL_API}${path}`, {
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
  // ── DATA (cloud Worker) ────────────────────────────────────────────────────
  listArtists: (
    params: {
      limit?: number;
      offset?: number;
      search?: string;
      minFollowers?: number;
      maxFollowers?: number;
      dmStatuses?: DmStatus[];
    } = {},
  ) => {
    const q = new URLSearchParams();
    if (params.limit) q.set("limit", String(params.limit));
    if (params.offset) q.set("offset", String(params.offset));
    if (params.search) q.set("search", params.search);
    if (typeof params.minFollowers === "number") q.set("minFollowers", String(params.minFollowers));
    if (typeof params.maxFollowers === "number") q.set("maxFollowers", String(params.maxFollowers));
    if (params.dmStatuses && params.dmStatuses.length > 0)
      q.set("dmStatus", params.dmStatuses.join(","));
    return cloudFetch<{ rows: Artist[]; total: number }>(`/api/artists?${q}`);
  },
  getArtist: (username: string) =>
    cloudFetch<ArtistDetail>(`/api/artists/${encodeURIComponent(username)}`),

  listTags: () => cloudFetch<{ rows: Tag[] }>(`/api/tags`),
  setTagTracked: (name: string, isTracked: boolean, priority?: number) =>
    cloudFetch<Tag>(`/api/tags/${encodeURIComponent(name)}`, {
      method: "PATCH",
      body: JSON.stringify({ isTracked, priority }),
    }),
  createTag: (name: string, isTracked = true) =>
    cloudFetch<Tag>(`/api/tags`, {
      method: "POST",
      body: JSON.stringify({ name, isTracked }),
    }),
  deleteTag: (name: string) =>
    cloudFetch<{ ok: true }>(`/api/tags/${encodeURIComponent(name)}`, { method: "DELETE" }),

  listJobs: () => cloudFetch<{ rows: Job[] }>(`/api/jobs`),

  listPrompts: () => cloudFetch<{ rows: Prompt[] }>(`/api/prompts`),
  createPrompt: (name: string, body: string, kind: PromptKind = "generate") =>
    cloudFetch<Prompt>(`/api/prompts`, {
      method: "POST",
      body: JSON.stringify({ name, body, kind }),
    }),
  updatePrompt: (id: number, patch: { name?: string; body?: string; kind?: PromptKind }) =>
    cloudFetch<Prompt>(`/api/prompts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  deletePrompt: (id: number) =>
    cloudFetch<{ ok: true }>(`/api/prompts/${id}`, { method: "DELETE" }),
  undoPrompt: (id: number) =>
    cloudFetch<Prompt>(`/api/prompts/${id}/undo`, { method: "POST" }),

  listGenerations: (username: string) =>
    cloudFetch<{ rows: Generation[] }>(
      `/api/generations/by-artist/${encodeURIComponent(username)}`,
    ),
  updateGeneration: (id: number, output: string) =>
    cloudFetch<Generation>(`/api/generations/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ output }),
    }),
  deleteGeneration: (id: number) =>
    cloudFetch<{ ok: true }>(`/api/generations/${id}`, { method: "DELETE" }),

  syncHubspot: (username: string) =>
    cloudFetch<HubSpotSyncResult>(
      `/api/hubspot/sync/${encodeURIComponent(username)}`,
      { method: "POST" },
    ),

  markGenerationReady: (id: number) =>
    cloudFetch<Generation>(`/api/hubspot/generations/${id}/ready`, { method: "POST" }),
  markGenerationSent: (id: number) =>
    cloudFetch<MarkSentResult>(`/api/hubspot/generations/${id}/sent`, { method: "POST" }),

  // ── ORCHESTRATION (local Hono — needs scraper running on user's laptop) ────
  scrapeHashtag: (hashtag: string) =>
    localFetch<Job>(`/api/jobs/scrape-hashtag`, {
      method: "POST",
      body: JSON.stringify({ hashtag }),
    }),
  scrapeArtist: (username: string) =>
    localFetch<Job>(`/api/jobs/scrape-artist`, {
      method: "POST",
      body: JSON.stringify({ username }),
    }),
  runTracked: () => localFetch<{ enqueued: Job[] }>(`/api/jobs/run-tracked`, { method: "POST" }),
  cancelJob: (jobId: number) =>
    localFetch<{ ok: true; killed: boolean }>(`/api/jobs/${jobId}/cancel`, { method: "POST" }),
  getQueueState: () => localFetch<QueueState>(`/api/jobs/queue`),
  getJobLogs: (jobId: number) =>
    localFetch<{
      jobId: number;
      lines: Array<{ ts: number; stream: "stdout" | "stderr" | "system"; line: string }>;
    }>(`/api/logs/${jobId}`),
  refinePrompt: (id: number, generationId: number, feedback: string) =>
    localFetch<{ proposedBody: string }>(`/api/prompts/${id}/refine`, {
      method: "POST",
      body: JSON.stringify({ generationId, feedback }),
    }),
  generate: (username: string, promptId: number) =>
    localFetch<Generation>(`/api/generations`, {
      method: "POST",
      body: JSON.stringify({ username, promptId }),
    }),
  previewGeneration: (username: string, body: string) =>
    localFetch<{ output: string; originalOutput: string }>(`/api/generations/preview`, {
      method: "POST",
      body: JSON.stringify({ username, body }),
    }),
};

/** Build a Worker-proxied image URL from the R2 key (same-origin via Vite proxy in dev). */
export function imageUrl(key: string | null | undefined): string | undefined {
  if (!key) return undefined;
  return `/api/images/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/** SSE stream URL for the local server (only available in local-agent mode). */
export function jobEventsUrl(): string {
  return `${LOCAL_API}/events/jobs`;
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
