# Instagram Scraper for GalleryTalk.io

## Purpose

This tool discovers verified artists on Instagram for [GalleryTalk.io](https://gallerytalk.io) - a virtual 3D gallery platform where users can walk through AI-curated exhibitions of real artwork. We scrape verified artists (blue checkmark) to ensure we're featuring legitimate, professional artists.

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

1. **Start from hashtag** (e.g., `#oilpainting`) to discover artists
2. **Find verified artists** (blue checkmark) in the hashtag feed
3. **Scrape 10 recent posts** per verified artist
4. **Download artwork images** to local storage
5. **Link everything** in the database for later curation

## Key Commands

```bash
# Database operations
bun run cli db check                    # Test database connection
bun run cli db save-artist '<json>'     # Save artist profile
bun run cli db save-post '<json>'       # Save post with images/hashtags

# Image operations
bun run cli images move-download -f <filename> -a <artist> -s <shortcode>

# Job tracking
bun run cli job create hashtag <name>   # Start a scrape job
bun run cli job start <id>
bun run cli job complete <id> <count>
bun run cli job list
```

## Database Schema

- **artists**: Verified Instagram profiles (username, bio, followers, etc.)
- **posts**: Individual posts linked to artists (shortcode, caption, likes)
- **images**: Image URLs and local paths linked to posts
- **hashtags**: Tracked hashtags with post counts
- **post_hashtags**: Junction table linking posts to hashtags
- **scrape_jobs**: Job tracking for scrape operations

## Image Download Flow

Instagram CDN URLs require session authentication. The workflow:

1. Use JavaScript `fetch()` inside the browser (has session cookies)
2. Convert response to dataURL via FileReader
3. Trigger browser download via anchor element click
4. Move file from Downloads to organized folder using CLI

```
./data/images/{username}/{shortcode}_0.jpg
```

## Claude Skills

### /scrape-hashtag <name>

Discovers verified artists from a hashtag page and scrapes their recent posts.

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
