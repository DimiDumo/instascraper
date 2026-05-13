// Thin typed HTTP client for the cloud Worker. Used by both the local CLI
// (commands invoked by scraper skills) and the local Hono orchestration server.
//
// Authentication: every request gets the Cloudflare Access Service Token headers
// (CF-Access-Client-Id / CF-Access-Client-Secret). CF Access at the edge converts
// those into a JWT before the Worker sees them.

const BASE = (process.env.CLOUD_API_URL ?? "").replace(/\/$/, "");
const CLIENT_ID = process.env.CF_ACCESS_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.CF_ACCESS_CLIENT_SECRET ?? "";

if (!BASE) {
  console.warn("[cloud] CLOUD_API_URL not set — local commands will fail until configured");
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "CF-Access-Client-Id": CLIENT_ID,
    "CF-Access-Client-Secret": CLIENT_SECRET,
    ...extra,
  };
}

// Cloudflare Workers' JSON parser rejects lone surrogate code points.
// Walk the payload and replace any lone surrogates with U+FFFD before serialising.
function sanitizeForJson(val: unknown): unknown {
  if (typeof val === "string")
    return val.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "�");
  if (Array.isArray(val)) return val.map(sanitizeForJson);
  if (val !== null && typeof val === "object")
    return Object.fromEntries(Object.entries(val as Record<string, unknown>).map(([k, v]) => [k, sanitizeForJson(v)]));
  return val;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body !== undefined
      ? authHeaders({ "Content-Type": "application/json" })
      : authHeaders(),
    body: body !== undefined ? JSON.stringify(sanitizeForJson(body)) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ============ ARTISTS ============
export const artists = {
  upsert: (data: Record<string, unknown>) => request<any>("POST", "/api/artists", data),
  get: (username: string) =>
    request<any>("GET", `/api/artists/${encodeURIComponent(username)}/lite`),
  detail: (username: string) =>
    request<any>("GET", `/api/artists/${encodeURIComponent(username)}`),
  list: (params: Record<string, string | number | undefined> = {}) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined) q.set(k, String(v));
    const qs = q.toString();
    return request<any>("GET", `/api/artists${qs ? `?${qs}` : ""}`);
  },
  setProfilePicKey: (username: string, key: string) =>
    request<any>("PATCH", `/api/artists/${encodeURIComponent(username)}/profile-pic-key`, { key }),
  byId: (id: number) => request<any>("GET", `/api/artists/by-id/${id}`),
};

// ============ POSTS ============
export const posts = {
  // Mirrors legacy save-post JSON payload (artistUsername + images[] + hashtags[]).
  upsert: (data: Record<string, unknown>) => request<any>("POST", "/api/posts", data),
  get: (shortcode: string) =>
    request<any>("GET", `/api/posts/${encodeURIComponent(shortcode)}`),
  setImageKey: (shortcode: string, key: string) =>
    request<any>("PATCH", `/api/posts/${encodeURIComponent(shortcode)}/image-key`, { key }),
};

// ============ JOBS ============
export const jobs = {
  list: (params: { limit?: number; status?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.limit) q.set("limit", String(params.limit));
    if (params.status) q.set("status", params.status);
    const qs = q.toString();
    return request<{ rows: any[] }>("GET", `/api/jobs${qs ? `?${qs}` : ""}`);
  },
  get: (id: number) => request<any>("GET", `/api/jobs/${id}`),
  create: (jobType: "hashtag" | "artist", target: string) =>
    request<any>("POST", "/api/jobs", { jobType, target }),
  start: (id: number) => request<any>("POST", `/api/jobs/${id}/start`),
  progress: (id: number, itemsScraped: number) =>
    request<any>("POST", `/api/jobs/${id}/progress`, { itemsScraped }),
  complete: (id: number, itemsScraped: number) =>
    request<any>("POST", `/api/jobs/${id}/complete`, { itemsScraped }),
  fail: (id: number, errorMessage: string) =>
    request<any>("POST", `/api/jobs/${id}/fail`, { errorMessage }),
  claimNext: () =>
    request<{ done: boolean; job?: { id: number; jobType: "hashtag" | "artist"; target: string }; remaining?: number; pending?: number }>(
      "POST",
      "/api/jobs/claim-next",
    ),
  pendingCount: () => request<{ pending: number }>("GET", "/api/jobs/pending-count"),
};

// ============ TAGS ============
export const tags = {
  list: () => request<{ rows: any[] }>("GET", "/api/tags"),
  tracked: () => request<{ rows: any[] }>("GET", "/api/tags/tracked"),
  set: (name: string, isTracked: boolean, priority?: number) =>
    request<any>("POST", "/api/tags", { name, isTracked, priority }),
  patch: (name: string, isTracked: boolean, priority?: number) =>
    request<any>("PATCH", `/api/tags/${encodeURIComponent(name)}`, { isTracked, priority }),
  delete: (name: string) =>
    request<{ ok: true }>("DELETE", `/api/tags/${encodeURIComponent(name)}`),
};

// ============ PROMPTS ============
export const prompts = {
  list: (kind?: "generate" | "cleanup") =>
    request<{ rows: any[] }>("GET", `/api/prompts${kind ? `?kind=${kind}` : ""}`),
  get: (id: number) => request<any>("GET", `/api/prompts/${id}`),
  create: (data: { name: string; body: string; kind?: "generate" | "cleanup" }) =>
    request<any>("POST", "/api/prompts", data),
  update: (id: number, data: Partial<{ name: string; body: string; kind: "generate" | "cleanup" }>) =>
    request<any>("PATCH", `/api/prompts/${id}`, data),
  delete: (id: number) => request<any>("DELETE", `/api/prompts/${id}`),
  undo: (id: number) => request<any>("POST", `/api/prompts/${id}/undo`),
};

// ============ HUBSPOT ============
export const hubspot = {
  initProperties: () =>
    request<{ ok: boolean; results: Array<{ name: string; status: "exists" | "created" }> }>(
      "POST",
      "/api/hubspot/init-properties",
    ),
  sync: (username: string) =>
    request<{ hubspotContactId: string; hubspotSyncedAt: string; hasDm: boolean }>(
      "POST",
      `/api/hubspot/sync/${encodeURIComponent(username)}`,
    ),
};

// ============ GENERATIONS ============
export const generations = {
  byArtist: (username: string) =>
    request<{ rows: any[] }>("GET", `/api/generations/by-artist/${encodeURIComponent(username)}`),
  get: (id: number) => request<any>("GET", `/api/generations/${id}`),
  // Local server creates the row here, then runs the local subprocess and patches output back.
  create: (data: { username: string; promptId: number; promptName?: string }) =>
    request<any>("POST", "/api/generations", data),
  patch: (id: number, patch: Record<string, unknown>) =>
    request<any>("PATCH", `/api/generations/${id}`, patch),
  setOutput: (id: number, output: string) =>
    request<any>("PATCH", `/api/generations/${id}`, { output }),
  delete: (id: number) => request<any>("DELETE", `/api/generations/${id}`),
};
