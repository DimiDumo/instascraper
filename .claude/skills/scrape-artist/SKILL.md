---
name: scrape-artist
description: Scrape a specific Instagram artist's profile and recent posts. Use when the user wants to scrape a known artist (e.g., "/scrape-artist username", "scrape @artistname"). Downloads profile data, recent posts, and artwork images to database.
---

# Scrape Artist

Scrape an Instagram artist's profile and recent posts, saving everything to the database.

## Usage
```
/scrape-artist <username>
```

## Workflow

### 1. Create and start job
```bash
bun run cli job create artist <username>
bun run cli job start <job_id>
```

### 2. Navigate to profile
```
navigate to https://www.instagram.com/<username>/
```
Wait 3 seconds for load.

### 3. Extract profile data
Use JavaScript to get: username, full name, bio, followers, following, posts count, verified status.

### 4. Save artist
```bash
bun run cli db save-artist '{"username": "<username>", "fullName": "<name>", "bio": "<bio>", "followersCount": <n>, "followingCount": <n>, "postsCount": <n>, "isVerified": false}'
```

### 5. Extract posts from grid (Fast Method)

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

### 5b. Fetch likes/comments/postedAt via web_profile_info

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

### 6. Download images
```bash
mkdir -p ./data/images/<username>
curl -s -o "./data/images/<username>/<shortcode>_0.jpg" "<image_url>"
```

### 7. Save posts (with stats)
```bash
bun run cli db save-post '{"shortcode": "<sc>", "artistUsername": "<user>", "postType": "image", "caption": "<alt>", "likesCount": <likes>, "commentsCount": <comments>, "postedAt": "<iso>"}'
bun run cli db update-post-image "<shortcode>" "./data/images/<username>/<shortcode>_0.jpg"
```

If shortcode missing from STATS map (older post beyond API window), omit `likesCount`/`commentsCount` to keep DB NULL rather than misleading `0`.

### 8. Complete job
```bash
bun run cli job complete <job_id> <posts_scraped>
```

## Error Handling
```bash
bun run cli job fail <job_id> "<error_message>"
```

Common issues:
- **Profile not found**: Username doesn't exist or is private
- **Login required**: User needs to authenticate in Chrome
- **Rate limited**: Increase delay between requests
