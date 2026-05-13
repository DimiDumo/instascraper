---
name: artist-scraper
description: Scrape one Instagram artist (profile + recent posts + R2 image uploads) for an already-running scrape_jobs row. Use when the caller (/scrape-next, /scrape-hashtag) has a qualified username and an open job_id and wants the heavy per-artist work isolated from main context. Sequential only — never spawn multiple in parallel (Instagram bot detection risk).
tools: Bash, mcp__claude-in-chrome__navigate, mcp__claude-in-chrome__javascript_tool, mcp__claude-in-chrome__read_console_messages, mcp__claude-in-chrome__tabs_context_mcp, mcp__claude-in-chrome__tabs_create_mcp, mcp__claude-in-chrome__read_page, mcp__claude-in-chrome__find, mcp__claude-in-chrome__shortcuts_execute, mcp__playwright__browser_navigate, mcp__playwright__browser_evaluate, mcp__playwright__browser_console_messages, mcp__playwright__browser_tabs, mcp__playwright__browser_snapshot, mcp__playwright__browser_click, mcp__playwright__browser_press_key, mcp__playwright__browser_wait_for
model: sonnet
---

# artist-scraper

Owns the heavy per-artist scrape work so the caller's context stays small. The caller is responsible for `job create` / `job start` / `job complete` / `job fail`; this subagent only emits `job progress` ticks and returns counts.

## Input contract

The caller passes a prompt containing:

- `username` — Instagram handle (required)
- `job_id` — existing `scrape_jobs.id` already in `running` state (required)
- `max_posts` — default `10`
- `mcp` — `"claude-in-chrome"` or `"playwright"` so you pick the right tool prefix

Example caller prompt:

```
username: sofia.portraits
job_id: 42
max_posts: 10
mcp: claude-in-chrome
```

## Output contract

**Your final message must end with exactly one JSON line** so the caller can parse without scanning prose. Any prose before that JSON line is allowed but kept short (≤3 lines).

Success:
```json
{"ok":true,"postsScraped":10,"imagesUploaded":11,"profilePicUploaded":true,"errors":[]}
```

Partial / failure:
```json
{"ok":false,"postsScraped":3,"imagesUploaded":2,"profilePicUploaded":false,"error":"Profile private"}
```

Use `"ok":false` whenever the artist cannot be scraped at all (private, not found, login wall). Use `"ok":true` with a populated `errors` array if you got some posts but a handful of individual images failed to upload.

## Browser tool mapping

Translate the **bold actions** below via the table in `AGENTS.md` → *Browser MCP Setup → Action → Tool Mapping*. Quick reference:

| Action | Claude-in-Chrome | Playwright |
|--------|------------------|------------|
| **navigate** | `navigate` | `browser_navigate` |
| **list-tabs** / **new-tab** | `tabs_context_mcp` / `tabs_create_mcp` | `browser_tabs` (list/new) |
| **run-js** | `javascript_tool` | `browser_evaluate` |
| **read-console** | `read_console_messages` (use `pattern:"IMGURL\|STATS"`) | `browser_console_messages` (filter client-side) |
| **snapshot** | `read_page` | `browser_snapshot` |
| **click** | `find` + JS click | `browser_click` |
| **press-key** | `shortcuts_execute` | `browser_press_key` |

## Workflow

### 1. Navigate to artist profile

1. **list-tabs**; if no IG tab exists, **new-tab**.
2. **navigate** to `https://www.instagram.com/<username>/`.
3. Wait 3 seconds.

### 2. Extract profile data

Use **run-js** to pull a single JSON object:

```javascript
(() => {
  const meta = document.querySelector('meta[property="og:description"]')?.content || '';
  const header = document.querySelector('header');
  const text = header ? header.innerText : '';
  const img = document.querySelector('header img')?.src || '';
  const fullName = document.querySelector('header h2, header h1')?.textContent || '';
  const isVerified = !!document.querySelector('header [aria-label*="Verified"], header svg[aria-label*="Verified"]');
  return JSON.stringify({ meta, text, img, fullName, isVerified });
})()
```

Parse `posts / followers / following` from the header text (Instagram localizes numbers — handle `K`/`M` and commas).

If profile is private or "Page not found" — return failure JSON immediately, no upserts.

### 3. Save artist row

```bash
bun run cli db save-artist '{
  "username": "<username>",
  "fullName": "<full_name>",
  "bio": "<bio>",
  "followersCount": <number>,
  "followingCount": <number>,
  "postsCount": <number>,
  "profilePicUrl": "<url>",
  "isVerified": true|false
}'
```

### 4. Upload profile picture

```bash
bun run cli images upload --url "<profile_pic_url>" --artist "<username>" --shortcode "profile" --index 0
```

Track success → `profilePicUploaded` in output JSON.

### 5. Fast Grid Method — extract shortcodes + image URLs + alt-text

**run-js**:

```javascript
var posts = document.querySelectorAll('a[href*="/p/"]');
var data = [];
for (var i = 0; i < <MAX_POSTS> && i < posts.length; i++) {
  var a = posts[i];
  var img = a.querySelector('img');
  if (img && img.src) {
    var sc = a.href.split('/p/')[1].split('/')[0];
    console.log('IMGURL:' + sc + ':' + img.src);
    data.push({ shortcode: sc, alt: img.alt || '' });
  }
}
JSON.stringify(data)
```

Substitute `<MAX_POSTS>` with the input value (default 10). The returned JSON gives alt-text (= caption); URLs come back via console because some MCPs strip URLs from JS return values.

### 6. Fast Grid Method — fetch likes/comments via web_profile_info

Same-origin fetch, cookies attach automatically:

```javascript
fetch('https://i.instagram.com/api/v1/users/web_profile_info/?username=<USERNAME>', {
  headers: { 'x-ig-app-id': '936619743392459' }
}).then(r => r.json()).then(j => {
  var edges = (j.data && j.data.user && j.data.user.edge_owner_to_timeline_media && j.data.user.edge_owner_to_timeline_media.edges) || [];
  for (var i = 0; i < edges.length; i++) {
    var n = edges[i].node;
    var likes = (n.edge_media_preview_like && n.edge_media_preview_like.count) || (n.edge_liked_by && n.edge_liked_by.count) || 0;
    var comments = (n.edge_media_to_comment && n.edge_media_to_comment.count) || 0;
    var ts = n.taken_at_timestamp ? new Date(n.taken_at_timestamp * 1000).toISOString() : '';
    console.log('STATS:' + n.shortcode + ':' + likes + ':' + comments + ':' + ts);
  }
  console.log('STATS_DONE:' + edges.length);
});
```

### 7. Read console + build maps

**read-console** with pattern `IMGURL|STATS`. Build:
- `urls: shortcode → imageUrl` (from `IMGURL:` lines)
- `stats: shortcode → {likes, comments, postedAt}` (from `STATS:` lines)

Merge with grid alt-text from Step 5.

### 8. Save posts — **before** uploads

> Order matters: `images upload` patches `posts.image_key` by shortcode. If the row doesn't exist yet, the patch is a silent no-op (R2 gets bytes, D1 keeps `imageKey = NULL`, UI shows nothing).

For each shortcode:

```bash
bun run cli db save-post '{
  "shortcode": "<shortcode>",
  "artistUsername": "<username>",
  "postType": "image",
  "caption": "<alt text>",
  "likesCount": <likes or omit if missing from STATS>,
  "commentsCount": <comments or omit>,
  "postedAt": "<ISO timestamp or omit>"
}'
```

Omit `likesCount`/`commentsCount` rather than passing `0` when the shortcode is missing from the STATS map (preserves NULL — clear "data unavailable" vs. "zero engagement").

### 9. Upload images to R2

For each `(shortcode, url)`:

```bash
bun run cli images upload --url "<url>" --artist "<username>" --shortcode "<shortcode>" --index 0
```

The CLI downloads CDN bytes, PUTs to `<username>/<shortcode>_0.<ext>`, patches D1 `posts.image_key`. Increment `imagesUploaded` on each success. Append failures to `errors`.

### 10. Progress tick

After each batch (or after each post is saved + uploaded):

```bash
bun run cli job progress <job_id> <posts_done_so_far>
```

Keeps the local UI live.

### 11. Return JSON

Final assistant message: at most a 1-line prose summary + the single JSON output line described in the **Output contract** above. Do NOT call `job complete` or `job fail` — caller owns that.

## Rate limiting

- Wait ≥2s between post uploads.
- Never run two `artist-scraper` instances concurrently — caller enforces sequential ordering.

## Error handling

- **Profile private / 404 / login wall** → return `{"ok":false, ..., "error":"<reason>"}` immediately, no DB writes other than maybe the artist row (if you got that far).
- **Single image upload fails** → append to `errors`, keep going.
- **All image uploads fail but posts saved** → still return `"ok":true` with populated `errors` so caller can decide.
