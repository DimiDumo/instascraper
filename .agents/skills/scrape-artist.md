# Scrape Artist Skill

Scrapes an Instagram artist's profile and their recent posts, saving everything to the database.

## Usage
```
/scrape-artist <username>
```

Example: `/scrape-artist banksy`

## Prerequisites
- Instagram session logged in for the active browser MCP (Claude-in-Chrome OR Playwright). See **Browser MCP Setup** in `AGENTS.md`.
- Cloud provisioned: D1 + R2 + CF Access (`AGENTS.md` → **Cloud setup**). Local `.env` populated with `CLOUD_API_URL`, `CF_ACCESS_CLIENT_ID/SECRET`, `R2_*`.

## Browser tool mapping

This skill uses **bold action verbs** that work with either MCP. Translate via the table in `AGENTS.md` → **Browser MCP Setup → Action → Tool Mapping**. Quick reference:

| Action | Claude-in-Chrome | Playwright |
|--------|------------------|------------|
| **navigate** | `navigate` | `browser_navigate` |
| **list-tabs** / **new-tab** | `tabs_context_mcp` / `tabs_create_mcp` | `browser_tabs` (list/new) |
| **run-js** | `javascript_tool` | `browser_evaluate` |
| **read-console** | `read_console_messages` | `browser_console_messages` |
| **snapshot** | `read_page` | `browser_snapshot` |
| **click** | `find` + JS click | `browser_click` |
| **press-key** | `shortcuts_execute` | `browser_press_key` |

## Instructions

When this skill is invoked with an Instagram username:

### 1. Create a scrape job

If the `INSTASCRAPER_JOB_ID` env var is set (skill was launched by the local UI's job runner), reuse that as `<job_id>` and **skip** the `job create` and `job start` steps below — the runner already created and started it.

Otherwise:
```bash
bun run cli job create artist <username>
```
Note the job ID returned.

### 2. Start the job
```bash
bun run cli job start <job_id>
```

### 2b. Dedup / staleness check
```bash
bun run cli db check-artist <username>
```
- `"status":"new"` or `"shouldRefresh":true` → continue to Step 3 (fresh scrape or stale refresh).
- `"seen":true` with `"shouldRefresh":false` → **skip the scrape**. The artist is fresh (scraped <3 months ago) or already DM'd (`dmStatus:"sent"`), or was previously rejected. Run `bun run cli job complete <job_id> 0`, tell the user why, and stop.

### 3. Navigate to artist's Instagram profile
1. **list-tabs** — current tabs
2. **new-tab** if needed
3. **navigate** to `https://www.instagram.com/<username>/`
4. Wait 3 seconds for the page to load

### 4. Extract profile data
Use **snapshot** or **run-js** to extract:
- **Full name**: Display name on profile
- **Bio**: Profile description
- **Followers count**: Number of followers
- **Following count**: Number following
- **Posts count**: Total posts
- **Profile picture URL**: Avatar image
- **Is verified**: Blue checkmark status

### 5. Save artist profile to database
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

### 6. Upload profile picture to R2
```bash
bun run cli images upload --url "<profile_pic_url>" --artist "<username>" --shortcode "profile" --index 0
```
Downloads the CDN URL and PUTs to R2 under `<username>/profile.<ext>`; updates the artist row's `profilePicKey`.

### 7. Scrape recent posts (up to 50)

#### For each post in the grid:

##### a. Click on the post thumbnail
Use **click** to open the post modal.

> **Faster alternative — Fast Grid Method:** Instead of clicking each post, extract all shortcodes + image URLs + alt-text captions from the profile grid in one **run-js** call (logging URLs via `console.log`), fetch likes/comments/postedAt for all posts in a single `web_profile_info` API call, then **read-console** and download images via `curl`. Full recipe in `.claude/skills/scrape-hashtag.md` → "Fast Grid Method" (Steps 1, 1b, 2, 3, 4). Recommended for ≤10 posts and now covers all stats — only fall back to per-post clicking when `web_profile_info` returns less than the requested 10 (older posts paginate beyond its window).

##### b. Extract post data
- **Shortcode**: From URL
- **Caption**: Post text
- **Likes count**: Number of likes
- **Comments count**: Number of comments
- **Image URLs**: All images in post
- **Posted date**: When it was posted (if available)
- **Post type**: image, video, or carousel

##### c. Save post to database
```bash
bun run cli db save-post '{
  "shortcode": "<shortcode>",
  "artistUsername": "<username>",
  "caption": "<caption>",
  "likesCount": <number>,
  "commentsCount": <number>,
  "postType": "image|video|carousel",
  "imageUrls": ["<url1>", "<url2>"],
  "hashtags": ["tag1", "tag2"]
}'
```

##### d. Upload images to R2
```bash
bun run cli images upload --url "<url>" --artist "<username>" --shortcode "<shortcode>" --index <n>
```
PUTs to R2 under `<username>/<shortcode>_<n>.<ext>`; updates the post's `imageKey` for the first image.

##### e. Update job progress
```bash
bun run cli job progress <job_id> <current_count>
```

##### f. Close modal and wait
**press-key** Escape, wait 2 seconds to avoid rate limiting.

### 8. Navigate to more posts
- Scroll down to load more posts
- Continue until 50 posts or end of profile

### 9. Complete the job
```bash
bun run cli job complete <job_id> <total_items_scraped>
```

## Error Handling

If any step fails:
```bash
bun run cli job fail <job_id> "<error_message>"
```

Common issues:
- **Profile not found**: Username doesn't exist or is private
- **Login required**: User needs to authenticate
- **Rate limited**: Increase delay between requests

## Output

The skill will save:
- Complete artist profile to `artists` table in Cloudflare D1
- Profile picture to R2 at `<username>/profile.jpg`
- All posts to `posts` table in D1
- All images to `images` table (URLs, dimensions, R2 keys, download status)
- All downloaded artwork to R2 bucket `instascraper-images` under `<username>/<shortcode>_<n>.<ext>`
- Hashtag associations for each post

## Notes

- For private profiles, only public information will be available
- Video posts will have their URLs saved but not downloaded
- Carousel posts will have all images extracted and downloaded
