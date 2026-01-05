# Scrape Hashtag Skill

Discovers verified artists from Instagram hashtag pages, scrapes their recent 10 posts, and downloads images.

## Usage
```
/scrape-hashtag <hashtag_name>
```

Example: `/scrape-hashtag oilpainting`

## Prerequisites
- User must be logged into Instagram in Chrome
- Database schema must be pushed (`bun run db:push`)

## Workflow

### 1. Setup
```bash
# Create and start a job
bun run cli job create hashtag <hashtag_name>
bun run cli job start <job_id>
```

### 2. Navigate to Hashtag Page
Use Claude in Chrome MCP:
1. `tabs_context_mcp` - get current tabs
2. `tabs_create_mcp` - create new tab
3. `navigate` to `https://www.instagram.com/explore/tags/<hashtag_name>/`
4. Wait 3 seconds for page load

### 3. Discover Verified Artists
For each post in the hashtag grid:

1. **Click on post** to open modal
2. **Check for verified badge** (blue checkmark next to username)
3. **If verified:**
   - Note the username
   - Navigate to their profile: `https://www.instagram.com/<username>/`
   - Run the artist scraping flow (see below)
4. **If not verified:** Close modal (press Escape), continue to next post
5. Continue until finding 5-10 verified artists

### 4. Scrape Verified Artist Profile
For each verified artist found:

#### a. Extract profile data
Use `read_page` to get:
- Username
- Full name
- Bio
- Followers/following count
- Posts count
- Verified status (should be true)

#### b. Save artist
```bash
bun run cli db save-artist '{
  "username": "<username>",
  "fullName": "<full_name>",
  "bio": "<bio>",
  "followersCount": <number>,
  "followingCount": <number>,
  "postsCount": <number>,
  "isVerified": true
}'
```

#### c. Scrape 10 most recent posts
For each of the first 10 posts on their profile:

1. **Click on post** to open it
2. **Extract post data:**
   - Shortcode (from URL `/p/<shortcode>/`)
   - Caption
   - Likes count
   - Comments count
   - Hashtags (from caption)
   - Posted date

3. **Save post:**
```bash
bun run cli db save-post '{
  "shortcode": "<shortcode>",
  "artistUsername": "<username>",
  "caption": "<caption>",
  "likesCount": <number>,
  "commentsCount": <number>,
  "postType": "image",
  "hashtags": ["tag1", "tag2"]
}'
```

4. **Download image:**

   a. Click on the image to open full-resolution in new tab

   b. Run JavaScript to capture and download:
   ```javascript
   (async () => {
     const img = document.querySelector('img');
     if (!img) return 'no image';
     await new Promise(r => img.complete ? r() : img.onload = r);
     const canvas = document.createElement('canvas');
     canvas.width = img.naturalWidth;
     canvas.height = img.naturalHeight;
     const ctx = canvas.getContext('2d');
     ctx.drawImage(img, 0, 0);
     window.__imageData = canvas.toDataURL('image/jpeg', 0.9);
     return 'Image captured: ' + img.naturalWidth + 'x' + img.naturalHeight;
   })();
   ```

   c. Trigger download:
   ```javascript
   (() => {
     const dataUrl = window.__imageData;
     if (!dataUrl) return 'no image data';
     const a = document.createElement('a');
     a.href = dataUrl;
     a.download = '<username>_<shortcode>.jpg';
     document.body.appendChild(a);
     a.click();
     document.body.removeChild(a);
     return 'Download triggered';
   })();
   ```

   d. Move to organized folder:
   ```bash
   bun run cli images move-download \
     -f "<username>_<shortcode>.jpg" \
     -a "<username>" \
     -s "<shortcode>"
   ```

5. **Navigate back** to profile (press back or navigate)
6. **Wait 2 seconds** between posts to avoid rate limiting

### 5. Complete Job
```bash
bun run cli job complete <job_id> <total_artists_scraped>
```

## Output Structure

```
./data/images/
  └── <username>/
      ├── <shortcode>_0.jpg
      ├── <shortcode>_0.jpg
      └── ...
```

Database records:
- `artists` - Verified artist profiles
- `posts` - Post metadata linked to artist
- `images` - Image URLs and local paths linked to posts

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
