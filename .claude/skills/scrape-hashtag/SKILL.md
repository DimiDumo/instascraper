---
name: scrape-hashtag
description: Discover emerging artists from Instagram hashtag pages for GalleryTalk.io outreach. Use when the user wants to find artists via hashtag (e.g., "/scrape-hashtag photography", "find artists from #oilpainting"). Scrapes profiles, evaluates artist fit, downloads artwork images, and saves to database.
---

# Scrape Hashtag

Discover emerging artists (1K-50K followers) from Instagram hashtag pages who create original visual art.

## Usage
```
/scrape-hashtag <hashtag_name>
```

## Target Artists

**Looking for:** Painters, photographers, illustrators, printmakers creating original work with 1K-50K followers.

**Skip:** AI art, galleries, 3D/sculptors, NFT accounts, bots, accounts outside follower range.

## Workflow

### 1. Setup
```bash
bun run cli job create hashtag <hashtag_name>
bun run cli job start <job_id>
```

### 2. Navigate to Hashtag
```
navigate to https://www.instagram.com/explore/search/keyword/?q=%23<hashtag_name>
```
(`/explore/tags/<name>/` redirects here — either works.)

Poll for posts to render instead of fixed sleep — run this JS every 2s, up to 10s:
```js
document.querySelectorAll('a[href*="/p/"]').length
```
Proceed once count > 0 (page typically needs 4–5s to hydrate).

Then collect all post links + alt text in one shot:
```js
const items = Array.from(document.querySelectorAll('a[href*="/p/"]')).map(a => ({
  post: a.href,
  alt: a.querySelector('img')?.alt || ''
}));
console.log('POST_ITEMS:' + JSON.stringify([...new Map(items.map(i=>[i.post,i])).values()]));
```
Read console with pattern `POST_ITEMS`.

Pre-filter from alt text before visiting profiles — skip where alt mentions: `school`, `course`, `brushes`, `tutorial`, `demo`, `proko`, `brainstorm`, `creative director`, `creatives`.

### 3. Discover Artists

For each post (after pre-filter):
1. Navigate to post URL to get username (run-js on `a[href]` filtered to profile paths)
2. Navigate to `https://www.instagram.com/<username>/`
3. Check followers (must be 1K-50K)
4. Extract profile + 10 recent captions
5. Run AI qualification (see `references/ai-evaluation.md`)
6. If score >= 70: scrape artist
7. If score < 70: skip
8. Continue until 5-10 qualifying artists found

### 4. Scrape Qualifying Artist — delegate to `artist-scraper` subagent

For each qualifying artist (score ≥ 70), spawn the `artist-scraper` subagent. It owns profile extract + save-artist, Fast Grid Method (shortcodes + URLs + alt-text + `web_profile_info` stats), save-post loop, R2 image uploads, and `job progress` ticks. Keeps ~50–80KB of per-artist tool chatter out of main context.

```
Agent({
  subagent_type: "artist-scraper",
  description: "Scrape <username>",
  prompt: "username: <username>\njob_id: <job_id>\nmax_posts: 10\nmcp: claude-in-chrome"   // or "playwright"
})
```

Subagent's final message ends with one JSON line, e.g. `{"ok":true,"postsScraped":10,"imagesUploaded":11,"profilePicUploaded":true,"errors":[]}`. Parse it. On `ok:true` increment `artists_saved_so_far` and emit `bun run cli job progress <job_id> <artists_saved_so_far>`. On `ok:false` log the error and continue with the next candidate — do **not** fail the hashtag job.

**Sequential only:** wait for each subagent to return before invoking the next. Sleep 5s between invocations. Never run two `artist-scraper` instances in parallel (Instagram bot detection).

Subagent definition: `.claude/agents/artist-scraper.md` (canonical at `.agents/agents/artist-scraper.md`).

### 5. Complete Job
```bash
bun run cli job complete <job_id> <artists_scraped>
```

## Error Handling
```bash
bun run cli job fail <job_id> "<error_message>"
```

## Resources

- **AI Evaluation Prompt**: See `references/ai-evaluation.md` for the full artist qualification prompt and scoring criteria.
