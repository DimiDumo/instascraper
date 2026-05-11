# Scrape Hashtag Skill

Discovers emerging artists from Instagram hashtag pages who are ideal customers for GalleryTalk.io - artists building communities who need a platform to showcase, promote, and monetize their art beyond social media.

## Usage
```
/scrape-hashtag <hashtag_name>
```

Example: `/scrape-hashtag oilpainting`

## Target Artist Profile (GalleryTalk.io Fit)

We're looking for **emerging artists** who:
- Create original visual art (painting, drawing, photography, printmaking, illustration, mixed media)
- Have 1,000-50,000 followers (emerging artist sweet spot)
- Show consistent artistic output and style
- Would benefit from an immersive virtual 3D gallery experience

**NOT looking for:**
- AI-generated art accounts (Midjourney, Stable Diffusion, etc.)
- Art galleries, museums, or marketplaces
- 3D artists, sculptors, installation artists (GalleryTalk focuses on "flat work")
- NFT-focused artists, graphic designers, fan art accounts
- Fake/bot accounts with generic bios

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

## Workflow

### 1. Setup

If the `INSTASCRAPER_JOB_ID` env var is set (skill was launched by the local UI's job runner), reuse that as `<job_id>` and **skip** `job create` and `job start` — the runner already created and started it.

Otherwise create a new job:
```bash
bun run cli job create hashtag <hashtag_name>
bun run cli job start <job_id>
```

Throughout the run, every time a qualifying artist is fully saved, emit a progress tick so the UI can stream live counts:
```bash
bun run cli job progress <job_id> <artists_saved_so_far>
```

### 2. Navigate to Hashtag Page
1. **list-tabs** — get current tabs
2. **new-tab** — open a fresh tab
3. **navigate** to `https://www.instagram.com/explore/tags/<hashtag_name>/`
4. Wait 3 seconds for page load

### 3. Discover Emerging Artists

For each post in the hashtag grid:

1. **Click on post** to open modal
2. **Get the username** from the post header
3. **Navigate to their profile**: `https://www.instagram.com/<username>/`
4. **Quick filter check**: Followers must be 1,000-50,000
5. **Extract profile data + 10 recent captions** for AI evaluation
6. **Run AI qualification** using the prompt below
7. **If score >= 70:** Run the artist scraping flow
8. **If score 40-69:** Flag for manual review, skip for now
9. **If score < 40:** Skip and continue to next post
10. Continue until finding 5-10 qualifying artists

#### AI-Powered Artist Qualification

After extracting profile data and captions, use this prompt to evaluate the artist:

```
You are an art market analyst evaluating whether an Instagram account represents a genuine emerging artist who would benefit from GalleryTalk.io - a virtual 3D gallery platform where artists showcase and sell their work while connecting face-to-face with collectors.

## Artist Data Provided:
- Name: [NAME]
- Instagram handle: [HANDLE]
- Follower count: [NUMBER]
- Bio: [BIO TEXT]
- Last 10 post captions: [CAPTIONS]

## Evaluation Criteria:

### ✅ POSITIVE SIGNALS (Likely to try GalleryTalk):
- Creates original visual art (painting, drawing, photography, printmaking, illustration, mixed media)
- Shows consistent artistic output and style
- Mentions being an artist, painter, photographer, visual creator in bio
- Posts include artist statements, process shots, or behind-the-scenes content
- Engages with their audience (asks questions, responds to comments based on caption tone)
- Mentions selling work, commissions, exhibitions, or galleries
- Has 1,000-50,000 followers (emerging artist sweet spot)
- Posts regularly about their art journey or creative process
- Located in a real place (city/country mentioned)
- Uses authentic, personal language in captions
- Mentions seeking galleries, collectors, or exposure

### ⚠️ NEUTRAL SIGNALS (Need more context):
- Very minimal captions (just emojis or hashtags)
- Mix of personal and art content
- Follower count above 50K (may already have representation)
- Student or recent graduate (might be interested but less budget)

### ❌ NEGATIVE SIGNALS (Filter out):
- **AI-generated art red flags:**
  - Bio mentions "AI artist," "digital art created with AI," "AI-generated," "midjourney," "stable diffusion," "generative art"
  - Captions discuss prompts, AI tools, or generation techniques
  - Extremely high post frequency (multiple posts per day of "new" finished work)
  - Inconsistent style across posts (wildly different techniques/mediums)
- **Fake/bot accounts:**
  - Generic bio with no personal information
  - Excessive hashtags with no personal text
  - Random follower/following ratio (e.g., 50K followers, following 50K)
  - Bio is just emojis or links with no description
  - Captions are only promotional or link spam
- **Not target audience:**
  - 3D artists, sculptors, installation artists (GalleryTalk focuses on "flat work")
  - NFT-focused artists (explicitly NFT-centric accounts)
  - Art collectors, galleries, or curators (not creators)
  - Graphic designers, UX/UI designers (commercial, not fine art)
  - Street artists, graffiti artists (work doesn't translate to digital galleries)
  - Fan art or meme accounts
  - Crafts, jewelry, fashion designers
  - Very low follower count (<500) with no engagement
  - Inactive accounts (no posts in last 3+ months)

## Output Format (JSON only):
{
  "qualified": true,
  "confidence": "high",
  "score": 85,
  "primary_reason": "Active oil painter from Berlin with engaged following, mentions exhibitions and commissions",
  "red_flags": [],
  "green_flags": ["Original artwork", "Sells commissions", "Process documentation", "Engaged captions"],
  "recommended_action": "send_outreach",
  "art_medium": "painting",
  "personalization_hook": "Your recent urban solitude series shows beautiful attention to light and shadow"
}

## Field Definitions:
- **qualified**: boolean - Is this artist a good fit for outreach?
- **confidence**: "high"/"medium"/"low" - How confident are you in this assessment?
- **score**: 0-100 - Overall qualification score
- **primary_reason**: One clear sentence explaining the decision
- **red_flags**: Array of concerns or negative signals found
- **green_flags**: Array of positive signals that indicate good fit
- **recommended_action**: "send_outreach" / "review_manually" / "discard"
- **art_medium**: "painting" / "photography" / "illustration" / "mixed" / "unknown"
- **personalization_hook**: A specific detail about their work to use in outreach (only if qualified)

## Scoring Guide:
- **80-100**: Strong candidate - Clear emerging artist, engaged audience, sells or seeks to sell
- **60-79**: Good candidate - Artist with potential but some uncertainty
- **40-59**: Borderline - Requires manual review
- **20-39**: Weak candidate - Not ideal fit but not fake
- **0-19**: Discard - AI art, fake account, or wrong audience

## Decision Logic:
- If score >= 70 AND no major red flags: qualified = true, recommended_action = "send_outreach"
- If score 40-69: qualified = false, recommended_action = "review_manually"
- If score < 40: qualified = false, recommended_action = "discard"
- Any AI art mention: automatic score < 20, discard
- Any clear bot/fake signals: automatic score < 20, discard

Return ONLY the JSON object, no additional text.
```

#### Extract Captions for Evaluation

Before running AI qualification, extract the last 10 post captions:

```javascript
// On profile page, click first post then navigate through
// For each post, extract caption from h1 element in article
var h1 = document.querySelector('article h1');
var caption = h1 ? h1.textContent : '';
```

Or use the batch method to get captions quickly by navigating to each post URL directly.

### 4. Scrape Qualifying Artist Profile

For each qualifying artist:

#### a. Extract profile data
Use **run-js** to extract:
- Username
- Full name
- Bio
- Followers/following count
- Posts count
- Profile picture URL

#### b. Save artist
```bash
bun run cli db save-artist '{
  "username": "<username>",
  "fullName": "<full_name>",
  "bio": "<bio>",
  "followersCount": <number>,
  "followingCount": <number>,
  "postsCount": <number>,
  "isVerified": false
}'
```

#### c. Scrape 10 most recent posts (Fast Grid Method - ~10x faster)

This method extracts image URLs directly from the profile grid and downloads via curl, avoiding the need to click into each post.

**Step 1: Extract shortcodes, URLs, and alt text from grid**

Run this JavaScript to log URLs to console AND return alt text (MCP blocks URLs in return values, but console.log works for URLs while alt text returns normally):

```javascript
var posts = document.querySelectorAll('a[href*="/p/"]');
var data = [];
for(var i=0; i<10 && i<posts.length; i++){
  var a = posts[i];
  var img = a.querySelector('img');
  if(img && img.src){
    var sc = a.href.split('/p/')[1].split('/')[0];
    console.log('IMGURL:' + sc + ':' + img.src);
    data.push({shortcode: sc, alt: img.alt || ''});
  }
}
JSON.stringify(data)
```

This returns the alt text directly (which IS the artist's caption):
```json
[
  {"shortcode": "DScuKtXDUbp", "alt": "Timeless • 久遠 #kyoto #photography #winter"},
  {"shortcode": "DTAxm0RDYmT", "alt": "Lost in the atmospheric glow of old Japan #kyoto #photography"}
]
```

**Step 1b: Fetch likes/comments via web_profile_info API**

Instagram's profile page DOM does not expose per-post like/comment counts. The undocumented `web_profile_info` endpoint does, uses session cookies, and returns up to ~12 most recent posts in one call. Run on the artist's profile tab (same origin → cookies sent automatically):

```javascript
fetch('https://i.instagram.com/api/v1/users/web_profile_info/?username=<username>', {
  headers: {'x-ig-app-id':'936619743392459'}
}).then(r=>r.json()).then(j=>{
  var edges = (j.data && j.data.user && j.data.user.edge_owner_to_timeline_media && j.data.user.edge_owner_to_timeline_media.edges) || [];
  for(var i=0;i<edges.length;i++){
    var n = edges[i].node;
    var likes = (n.edge_media_preview_like && n.edge_media_preview_like.count) || (n.edge_liked_by && n.edge_liked_by.count) || 0;
    var comments = (n.edge_media_to_comment && n.edge_media_to_comment.count) || 0;
    var ts = n.taken_at_timestamp ? new Date(n.taken_at_timestamp*1000).toISOString() : '';
    console.log('STATS:'+n.shortcode+':'+likes+':'+comments+':'+ts);
  }
  console.log('STATS_DONE:'+edges.length);
});
```

Replace `<username>` with the artist's handle. The `x-ig-app-id` header value `936619743392459` is the public web client ID.

**Step 2: Read URLs and stats from console**

Use **read-console** to retrieve both the `IMGURL:` entries from Step 1 and the `STATS:` entries from Step 1b.

- Playwright: `browser_console_messages` (no level filter — filter the result client-side).
- Claude-in-Chrome: `read_console_messages` (supports a `pattern` regex; pass `IMGURL|STATS` to pre-filter).

Entries look like:
```
IMGURL:DTAXX54EZxZ:https://instagram.fsgn2-6.fna.fbcdn.net/v/t51.82787-15/...
STATS:DTAXX54EZxZ:1234:56:2026-04-21T10:15:00.000Z
```

Build a map `shortcode → {likes, comments, postedAt}` from the `STATS:` lines, then merge with the grid data from Step 1.

**Step 3: Upload all images to R2**

For each URL extracted, run the CLI uploader. It downloads the CDN bytes and PUTs to R2 under the canonical key `<username>/<shortcode>_<n>.<ext>`, and also writes the key back into the post's `imageKey` column in D1.

```bash
bun run cli images upload --url "<image_url>" --artist "<username>" --shortcode "<shortcode>" --index 0
```

Example:
```bash
bun run cli images upload \
  --url "https://instagram.fsgn2-6.fna.fbcdn.net/v/t51.82787-15/610538973_..." \
  --artist "sofia.portraits" --shortcode "DTAXX54EZxZ" --index 0
```

**Step 4: Save posts to database with caption + stats**

The alt text from Step 1 serves as the caption (Instagram's auto-generated description). The stats from Step 1b supply likes/comments/postedAt. For each post:

```bash
bun run cli db save-post '{
  "shortcode": "<shortcode>",
  "artistUsername": "<username>",
  "postType": "image",
  "caption": "<alt text from grid>",
  "likesCount": <likes from STATS map>,
  "commentsCount": <comments from STATS map>,
  "postedAt": "<ISO timestamp from STATS map>"
}'
```

Example with actual data:
```bash
bun run cli db save-post '{
  "shortcode": "DScuKtXDUbp",
  "artistUsername": "da_frames",
  "postType": "image",
  "caption": "Timeless • 久遠 #kyoto #photography #winter",
  "likesCount": 1234,
  "commentsCount": 56,
  "postedAt": "2026-04-21T10:15:00.000Z"
}'
```

If a shortcode is missing from the `STATS` map (e.g. older post not returned by `web_profile_info`), omit `likesCount`/`commentsCount` rather than passing `0` — preserves NULL in DB so it's clear data was unavailable vs. zero engagement.

> **Note:** The alt text IS the artist's actual caption when they provide one. Instagram only auto-generates a description (like "May be an image of...") when the artist leaves the caption empty. So this alt text is the primary source for captions.

The `images upload` command in Step 3 already wrote the `imageKey` back to D1 — no extra update step needed.

**Step 5: (Optional) Get full captions/likes for specific posts**

If you need full caption or engagement data, navigate to the post page:

```javascript
// On post page https://www.instagram.com/p/<shortcode>/
var article = document.querySelector('article');
var h1 = article ? article.querySelector('h1') : null;
var time = document.querySelector('time[datetime]');
var text = article ? article.textContent : '';
var idx = text.indexOf('Like');
var sub = idx >= 0 ? text.substring(idx + 4, idx + 30) : '';
var likesRaw = sub.split('Comment')[0] || '0';
function parseCount(s) {
  s = s.trim();
  if (s.includes('K')) return Math.round(parseFloat(s) * 1000);
  if (s.includes('M')) return Math.round(parseFloat(s) * 1000000);
  return parseInt(s.replace(/,/g, '')) || 0;
}
JSON.stringify({
  caption: h1 ? h1.textContent : null,
  postedAt: time ? time.getAttribute('datetime') : null,
  likesCount: parseCount(likesRaw)
})
```

### Why This Method is Faster

| Old Method | New Method |
|------------|------------|
| Navigate to each post (10 page loads) | Stay on profile page |
| Wait 2s per post (20s total) | Single JS execution |
| Canvas download + file move | Direct curl download |
| ~30-40 seconds for 10 posts | ~5 seconds for 10 posts |

### 5. Complete Job
```bash
bun run cli job complete <job_id> <total_artists_scraped>
```

## Output Structure

R2 bucket `instascraper-images`:
```
<username>/
  ├── profile.jpg
  ├── <shortcode>_0.jpg
  ├── <shortcode>_1.jpg
  └── ...
```

D1 records:
- `artists` - Emerging artist profiles with `profilePicKey` referencing R2
- `posts` - Post metadata with `imageKey` referencing R2 thumbnail
- `images` - Individual images from posts with URLs and `r2Key`
- `hashtags` / `post_hashtags` - Tracked hashtags and post associations
- `scrape_jobs` - Job tracking for scrape operations

## Example AI Evaluations

**QUALIFIED (Score: 85):**
```
@marina.creates.art
Followers: 8,432
Bio: "Oil painter | NYC | Exploring light & shadow | Commissions open | Shop link in bio"
Captions: "Spent 3 weeks on this piece exploring urban solitude...", "New work available, DM for details"

AI Response:
{
  "qualified": true,
  "confidence": "high",
  "score": 85,
  "primary_reason": "Active oil painter with exhibition experience, sells commissions, engaged storytelling",
  "red_flags": [],
  "green_flags": ["Original artwork", "Sells commissions", "Process documentation", "Authentic voice"],
  "recommended_action": "send_outreach",
  "art_medium": "painting",
  "personalization_hook": "Your urban solitude series and attention to light and shadow really stands out"
}
```

**DISCARD - AI Art (Score: 10):**
```
@ai_dreamscapes
Followers: 15,000
Bio: "AI Art Creator | Making magic with Midjourney ✨ | Daily drops"
Captions: "Prompt: 'ethereal goddess in moonlight, hyperrealistic, 8k' - what do you think?"

AI Response:
{
  "qualified": false,
  "confidence": "high",
  "score": 10,
  "primary_reason": "AI-generated art account, not target audience for human-created art platform",
  "red_flags": ["AI-generated art", "Mentions AI tools in bio", "Prompt-based workflow"],
  "green_flags": [],
  "recommended_action": "discard",
  "art_medium": "unknown",
  "personalization_hook": ""
}
```

**REVIEW MANUALLY (Score: 45):**
```
@artsy_vibes_2024
Followers: 3,200
Bio: "Artist 🎨 | NYC"
Captions: "#art #painting #contemporary #artist #artistsoninstagram #instaart..."

AI Response:
{
  "qualified": false,
  "confidence": "low",
  "score": 45,
  "primary_reason": "Minimal information, unclear if genuine emerging artist or engagement farming",
  "red_flags": ["Excessive hashtags", "No personal information", "Generic captions"],
  "green_flags": ["Claims to be artist", "Mentions painting"],
  "recommended_action": "review_manually",
  "art_medium": "painting",
  "personalization_hook": ""
}
```

**DISCARD - Wrong Audience (Score: 25):**
```
@3d_character_pro
Followers: 12,000
Bio: "3D Character Artist | Game Dev | Blender enthusiast"
Captions: "Finally finished this character model after 40 hours of sculpting..."

AI Response:
{
  "qualified": false,
  "confidence": "high",
  "score": 25,
  "primary_reason": "3D artist working in digital sculpting, not target audience for 2D/flat work gallery",
  "red_flags": ["3D art focus", "Not flat work", "Game development context"],
  "green_flags": ["Genuine artist", "Shows process"],
  "recommended_action": "discard",
  "art_medium": "unknown",
  "personalization_hook": ""
}
```

**DISCARD - Gallery Account (Score: 15):**
```
@saatchiart
Followers: 1,100,000
Bio: "World's leading online art gallery"
Content: Curated posts from various artists

AI Response:
{
  "qualified": false,
  "confidence": "high",
  "score": 15,
  "primary_reason": "Art marketplace/gallery account, not an individual artist",
  "red_flags": ["Gallery account", "Massive following", "Curated content not original work"],
  "green_flags": [],
  "recommended_action": "discard",
  "art_medium": "unknown",
  "personalization_hook": ""
}
```

## Error Handling

If any step fails:
```bash
bun run cli job fail <job_id> "<error_message>"
```

Common issues:
- **Login required**: User needs to log into Instagram
- **Rate limited**: Increase delay between requests
- **Post unavailable**: Skip and continue
- **Download failed**: Retry or skip image
- **No qualifying artists found**: Try a different hashtag with more emerging artists

## Recommended Hashtags for Finding Emerging Artists

Good hashtags to try:
- `#emergingartist` (though many won't qualify on followers)
- `#artistsoninstagram`
- `#oilpainting`, `#acrylicpainting`, `#watercolorart`
- `#contemporaryart`, `#modernart`
- `#abstractart`, `#figurativeart`
- `#studiolife`, `#artstudio`
- `#artistlife`, `#paintingprocess`

Avoid hashtags dominated by galleries/businesses:
- `#artforsale` (too commercial)
- `#artcollector` (collectors, not artists)
- `#galleryart` (galleries dominate)
