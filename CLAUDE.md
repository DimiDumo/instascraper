# Instagram Scraper for GalleryTalk.io

## Purpose

This tool discovers **emerging artists** on Instagram who are ideal customers for [GalleryTalk.io](https://gallerytalk.io) - a virtual 3D gallery platform that empowers artists to create interactive galleries to showcase, promote, and monetize their art.

### Target Customer Profile

We're looking for **emerging artists** (1,000 - 100,000 followers) who:
- Are building an audience but struggle to showcase beyond social media
- Create original artwork (painters, sculptors, illustrators, etc.)
- Would benefit from an immersive virtual gallery experience
- Have engaged followers who might donate or purchase art

**NOT looking for:**
- Art galleries, museums, or marketplaces (Saatchi Art, Artsy, etc.)
- Art supply stores, print shops, or framing businesses
- Curators, art magazines, or media accounts
- Accounts with 100K+ followers (already established)
- Accounts with <1K followers (not ready yet)

> **Note:** We do NOT filter by Instagram's blue checkmark. Verification badges typically go to businesses and celebrities, not emerging artists.

## Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript
- **Database**: SQLite with Drizzle ORM
- **Browser Automation**: Claude in Chrome MCP
- **CLI**: Commander.js

## Quick Start

```bash
# Install dependencies
bun install

# Push database schema
bun run db:push

# View database (optional)
bun run db:studio
```

## Workflow Overview

1. **Start from hashtag** (e.g., `#oilpainting`, `#emergingartist`) to discover artists
2. **Evaluate each artist** against qualification criteria (followers, bio, content)
3. **Scrape 10 recent posts** per qualifying artist
4. **Download artwork images** to local storage
5. **Link everything** in the database for later outreach/curation

## Artist Qualification Criteria

### MUST HAVE (all required):
- Followers: **1,000 - 100,000**
- Bio indicates individual artist (contains: "artist", "painter", "sculptor", etc.)
- Content is original artwork

### SKIP IF ANY:
- Bio contains: "gallery", "museum", "shop", "marketplace", "curator"
- Username suggests business (ends in "gallery", "studio" as a business)
- Follower count outside 1K-100K range
- Content is reposts or promotional material

See `.claude/skills/scrape-hashtag.md` for detailed criteria and examples.

## Key Commands

```bash
# Database operations
bun run cli db check                    # Test database connection
bun run cli db save-artist '<json>'     # Save artist profile
bun run cli db save-post '<json>'       # Save post with images/hashtags
bun run cli db update-post-image <shortcode> <path>  # Update post's image path

# Image operations
bun run cli images move-download -f <filename> -a <artist> -s <shortcode>

# Job tracking
bun run cli job create hashtag <name>   # Start a scrape job
bun run cli job start <id>
bun run cli job complete <id> <count>
bun run cli job list
```

## Database Schema

- **artists**: Emerging artist profiles (username, bio, followers, etc.)
- **posts**: Individual posts linked to artists, with `image_local_path` for downloaded image
- **hashtags**: Tracked hashtags with post counts
- **post_hashtags**: Junction table linking posts to hashtags
- **scrape_jobs**: Job tracking for scrape operations

## Image Download Flow

**Fast Method (Recommended):** Instagram CDN URLs are publicly accessible. Extract URLs from the profile grid and download directly via curl:

1. On profile page, use JavaScript + `console.log` to extract image URLs (MCP blocks URLs in return values)
2. Read URLs via `read_console_messages` tool
3. Download images directly via `curl -o ./data/images/<username>/<shortcode>_0.jpg <url>`
4. Update DB with `bun run cli db update-post-image <shortcode> <path>`

**Legacy Method:** If direct URLs don't work:
1. Use canvas capture inside the browser (has session cookies)
2. Convert to dataURL and trigger download
3. Move file from Downloads to organized folder using `bun run cli images move-download`

```
./data/images/{username}/{shortcode}_0.jpg
```

## Claude Skills

### /scrape-hashtag <name>

Discovers emerging artists from a hashtag page and scrapes their recent posts.

See `.claude/skills/scrape-hashtag.md` for the full workflow.

### /scrape-artist <username>

Scrapes a specific artist's profile and recent posts.

See `.claude/skills/scrape-artist.md` for the full workflow.

## Prerequisites

- User must be logged into Instagram in Chrome
- Chrome browser (not Brave - MCP extension requires Chrome)
- Claude in Chrome extension installed and connected

## Project Structure

```
instascraper/
├── src/
│   ├── db/
│   │   ├── schema.ts       # Drizzle schema definitions
│   │   ├── client.ts       # SQLite connection
│   │   └── index.ts        # DB query functions
│   ├── commands/
│   │   ├── save-artist.ts  # Artist CRUD
│   │   ├── save-post.ts    # Post CRUD with images/hashtags
│   │   ├── download-image.ts # Image download utilities
│   │   └── job-status.ts   # Job tracking
│   └── index.ts            # CLI entry point
├── .claude/skills/         # Claude Code skills
├── data/
│   ├── images/             # Downloaded artwork (gitignored)
│   └── instascraper.db     # SQLite database (gitignored)
└── drizzle.config.ts       # Drizzle ORM config
```

## Rate Limiting

- Wait 2 seconds between post extractions
- Wait 3 seconds after page navigation
- Instagram may block if requests are too fast

## Error Handling

If a scrape fails:
```bash
bun run cli job fail <id> "error message"
```

Common issues:
- **Login required**: Log into Instagram in Chrome first
- **Rate limited**: Increase delays between requests
- **Extension disconnected**: Restart Chrome and reconnect MCP
- **No qualifying artists**: Try different hashtags (see skill for recommendations)
