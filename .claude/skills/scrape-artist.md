# Scrape Artist Skill

Scrapes an Instagram artist's profile and their recent posts, saving everything to the database.

## Usage
```
/scrape-artist <username>
```

Example: `/scrape-artist banksy`

## Prerequisites
- User must be logged into Instagram in Chrome
- MySQL database must be running (`bun run docker:up`)
- Database schema must be pushed (`bun run db:push`)

## Instructions

When this skill is invoked with an Instagram username:

### 1. Create a scrape job
```bash
bun run cli job create artist <username>
```
Note the job ID returned.

### 2. Start the job
```bash
bun run cli job start <job_id>
```

### 3. Navigate to artist's Instagram profile
Use Claude in Chrome MCP tools to:
1. Get the current tab context with `tabs_context_mcp`
2. Create a new tab if needed with `tabs_create_mcp`
3. Navigate to `https://www.instagram.com/<username>/`
4. Wait for the page to load

### 4. Extract profile data
Use `read_page` or `browser_snapshot` to extract:
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

### 6. Download profile picture
```bash
bun run cli images download --url "<profile_pic_url>" --artist "<username>" --shortcode "profile" --index 0
```

### 7. Scrape recent posts (up to 50)

#### For each post in the grid:

##### a. Click on the post thumbnail
Use `browser_click` to open the post modal.

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

##### d. Download images
```bash
bun run cli images download --url "<url>" --artist "<username>" --shortcode "<shortcode>" --index <n>
```

##### e. Update job progress
```bash
bun run cli job progress <job_id> <current_count>
```

##### f. Close modal and wait
Press Escape, wait 2 seconds to avoid rate limiting.

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
- Complete artist profile to `artists` table
- Profile picture to `./data/images/<username>/profile.jpg`
- All posts to `posts` table
- All images to `images` table and `./data/images/<username>/`
- Hashtag associations for each post

## Notes

- For private profiles, only public information will be available
- Video posts will have their URLs saved but not downloaded
- Carousel posts will have all images extracted and downloaded
