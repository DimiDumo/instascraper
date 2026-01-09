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
navigate to https://www.instagram.com/explore/tags/<hashtag_name>/
```
Wait 3 seconds for load.

### 3. Discover Artists

For each post in the grid:
1. Click post to open modal
2. Get username from header
3. Navigate to `https://www.instagram.com/<username>/`
4. Check followers (must be 1K-50K)
5. Extract profile + 10 recent captions
6. Run AI qualification (see `references/ai-evaluation.md`)
7. If score >= 70: scrape artist
8. If score < 70: skip
9. Continue until 5-10 qualifying artists found

### 4. Scrape Qualifying Artist

#### a. Extract profile data
Use JavaScript to get: username, full name, bio, followers, following, posts count.

#### b. Save artist
```bash
bun run cli db save-artist '{"username": "<username>", "fullName": "<name>", "bio": "<bio>", "followersCount": <n>, "followingCount": <n>, "postsCount": <n>}'
```

#### c. Extract posts from grid (Fast Method)

Run JavaScript to log URLs and get captions:
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

Read URLs from console:
```
read_console_messages(tabId, pattern="IMGURL", limit=20)
```

#### d. Download images
```bash
mkdir -p ./data/images/<username>
curl -s -o "./data/images/<username>/<shortcode>_0.jpg" "<image_url>"
```

#### e. Save posts
```bash
bun run cli db save-post '{"shortcode": "<sc>", "artistUsername": "<user>", "postType": "image", "caption": "<alt>"}'
bun run cli db update-post-image "<shortcode>" "./data/images/<username>/<shortcode>_0.jpg"
```

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
