# Scrape Hashtag Skill

Discovers emerging artists from Instagram hashtag pages who are ideal customers for GalleryTalk.io - artists building communities who need a platform to showcase, promote, and monetize their art beyond social media.

## Usage
```
/scrape-hashtag <hashtag_name>
```

Example: `/scrape-hashtag oilpainting`

## Target Artist Profile (GalleryTalk.io Fit)

We're looking for **emerging artists** who:
- Are building an audience but struggle to showcase beyond social media
- Create original artwork (not reposts or promotional content)
- Would benefit from an immersive virtual gallery experience
- Have engaged followers who might donate or purchase art

**NOT looking for:**
- Art galleries, museums, or marketplaces (like Saatchi Art, Artsy)
- Art supply stores or print shops
- Curators, art magazines, or media accounts
- Massive accounts that are already established

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

### 3. Discover Emerging Artists

For each post in the hashtag grid:

1. **Click on post** to open modal
2. **Get the username** from the post header
3. **Navigate to their profile**: `https://www.instagram.com/<username>/`
4. **Evaluate if they qualify** using the criteria below
5. **If qualifies:** Run the artist scraping flow
6. **If not:** Go back to hashtag page, continue to next post
7. Continue until finding 5-10 qualifying artists

#### Qualification Criteria

**MUST HAVE (all required):**
- [ ] **Followers: 1,000 - 100,000** (emerging artist range)
- [ ] **Bio indicates individual artist** - contains keywords like:
  - "artist", "painter", "sculptor", "illustrator"
  - "fine art", "contemporary art", "visual artist"
  - "oil painting", "acrylic", "watercolor", "mixed media"
  - Art medium mentions (canvas, ceramic, photography as art)
- [ ] **Content is original artwork** - their posts show their own creations

**SKIP IF ANY:**
- [ ] Bio contains: "gallery", "museum", "shop", "store", "marketplace"
- [ ] Bio contains: "curator", "magazine", "media", "agency", "prints for sale"
- [ ] Bio contains: "art supplies", "framing", "commission closed"
- [ ] Username/name suggests business: ends in "gallery", "art", "studio" (as a business)
- [ ] Content is primarily reposts, quotes, or promotional material
- [ ] Follower count < 1,000 (too small, not ready)
- [ ] Follower count > 100,000 (already established)
- [ ] Verified badge with business indicators (likely a company, not emerging artist)

**GOOD SIGNS (bonus, not required):**
- Links to personal portfolio or Linktree
- Mentions commissions, prints, or "DM for inquiries"
- Active engagement (recent posts, responds to comments)
- Uses hashtags like #emergingartist, #artistsoninstagram
- Has a cohesive artistic style/brand

### 4. Scrape Qualifying Artist Profile

For each qualifying artist:

#### a. Extract profile data
Use `read_page` or JavaScript to get:
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
  "postedAt": "<ISO datetime from time element>",
  "hashtags": ["tag1", "tag2"]
}'
```

4. **Extract post data and download image:**

   Use JavaScript to extract likes, posted date, and download the image:
   ```javascript
   (async () => {
     await new Promise(r => setTimeout(r, 1000));
     // Get likes count
     const likesEl = document.querySelector('section span span');
     const likes = likesEl ? parseInt(likesEl.textContent.replace(/[^0-9]/g, '')) || 0 : 0;
     // Get posted date from first time element
     const timeEl = document.querySelector('time[datetime]');
     const postedAt = timeEl ? timeEl.getAttribute('datetime') : null;
     // Find and download largest image
     const imgs = document.querySelectorAll('img');
     let largest = null;
     let maxArea = 0;
     for (const img of imgs) {
       if (img.naturalWidth > 200 && img.naturalHeight > 200) {
         const area = img.naturalWidth * img.naturalHeight;
         if (area > maxArea) { maxArea = area; largest = img; }
       }
     }
     if (!largest || maxArea < 50000) return JSON.stringify({ likes, postedAt, image: null });
     const canvas = document.createElement('canvas');
     canvas.width = largest.naturalWidth;
     canvas.height = largest.naturalHeight;
     const ctx = canvas.getContext('2d');
     ctx.drawImage(largest, 0, 0);
     const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
     const a = document.createElement('a');
     a.href = dataUrl;
     a.download = '<username>_<shortcode>.jpg';
     document.body.appendChild(a);
     a.click();
     document.body.removeChild(a);
     return JSON.stringify({ likes, postedAt, image: largest.naturalWidth + 'x' + largest.naturalHeight });
   })();
   ```

   Move to organized folder:
   ```bash
   bun run cli images move-download \
     -f "<username>_<shortcode>.jpg" \
     -a "<username>" \
     -s "<shortcode>"
   ```

5. **Navigate to next post** using ArrowRight key or Next button
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
- `artists` - Emerging artist profiles (GalleryTalk.io prospects)
- `posts` - Post metadata with `image_local_path` linking to downloaded image

## Example Qualifying vs Non-Qualifying

**QUALIFIES:**
```
@marina.creates.art
Followers: 8,432
Bio: "Oil painter | NYC | Exploring light & shadow | Commissions open | Shop link in bio"
Content: Original oil paintings, studio shots, work in progress
→ Perfect GalleryTalk.io customer
```

**SKIP:**
```
@saatchiart
Followers: 1,100,000
Bio: "World's leading online art gallery"
Content: Curated posts from various artists
→ This is a marketplace/competitor, not a customer
```

**SKIP:**
```
@artsy_gallery_nyc
Followers: 45,000
Bio: "Contemporary Art Gallery | Exhibitions & Sales | NYC"
Content: Gallery installations, artist features
→ This is a physical gallery, not an emerging artist
```

**SKIP:**
```
@tiny_art_beginner
Followers: 287
Bio: "Just started painting!"
Content: Hobby artwork
→ Too small, not ready for platform yet
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
