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

Read URLs from console:
```
read_console_messages(tabId, pattern="IMGURL", limit=20)
```

### 6. Download images
```bash
mkdir -p ./data/images/<username>
curl -s -o "./data/images/<username>/<shortcode>_0.jpg" "<image_url>"
```

### 7. Save posts
```bash
bun run cli db save-post '{"shortcode": "<sc>", "artistUsername": "<user>", "postType": "image", "caption": "<alt>"}'
bun run cli db update-post-image "<shortcode>" "./data/images/<username>/<shortcode>_0.jpg"
```

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
