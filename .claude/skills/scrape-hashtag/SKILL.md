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

#### c2. Fetch likes/comments/postedAt via web_profile_info

Profile DOM does not expose per-post engagement. The `web_profile_info` endpoint returns the ~12 most recent posts with full stats in one call. Run on the artist's profile tab so session cookies are sent:

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

Read both `IMGURL:` and `STATS:` entries from console:
```
read_console_messages(tabId, pattern="IMGURL|STATS", limit=40)
```

Build a `shortcode → {likes, comments, postedAt}` map from `STATS:` lines.

#### d. Download images
```bash
mkdir -p ./data/images/<username>
curl -s -o "./data/images/<username>/<shortcode>_0.jpg" "<image_url>"
```

#### e. Save posts (with stats)
```bash
bun run cli db save-post '{"shortcode": "<sc>", "artistUsername": "<user>", "postType": "image", "caption": "<alt>", "likesCount": <likes>, "commentsCount": <comments>, "postedAt": "<iso>"}'
bun run cli db update-post-image "<shortcode>" "./data/images/<username>/<shortcode>_0.jpg"
```

If a shortcode is not in the STATS map (older post beyond the API window), omit `likesCount`/`commentsCount` so DB stays NULL rather than misleading `0`.

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
