# Instagram Scraper for GalleryTalk.io

> **Agent Memory File:** This file (`AGENTS.md`) is the source of truth for agent context. `CLAUDE.md` is a symlink pointing to this file so Claude Code and other agents can discover it. Edit this file directly; `CLAUDE.md` will reflect changes automatically.

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
- **Browser Automation**: Either **Claude-in-Chrome MCP** (Claude Code only) or **Playwright MCP** (any agent harness)
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
2. **Evaluate each artist** with AI against qualification criteria (followers, bio, content)
3. **Scrape recent posts** per qualifying artist using the fast grid method (~10 posts for hashtag flow, up to 50 for dedicated artist scrapes)
4. **Download artwork images** to local storage via direct CDN curl
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
bun run cli images download -u <url> -a <artist> -s <shortcode>     # Download single image
bun run cli images download-post <shortcode> <artist>                # Download all images for a post
bun run cli images save-screenshot -f <path> -a <artist> -s <shortcode>  # Copy screenshot to organized dir
bun run cli images move-download -f <filename> -a <artist> -s <shortcode>  # Move from Downloads folder

# Job tracking
bun run cli job create hashtag <name>   # Start a hashtag scrape job
bun run cli job create artist <username>  # Start an artist scrape job
bun run cli job start <id>
bun run cli job complete <id> <count>
bun run cli job list
```

## Database Schema

- **artists**: Emerging artist profiles (username, bio, followers, etc.)
- **posts**: Individual posts linked to artists, with `image_local_path` for downloaded image
- **images**: Individual images from posts (URL, local path, dimensions, download status)
- **hashtags**: Tracked hashtags with post counts
- **post_hashtags**: Junction table linking posts to hashtags
- **scrape_jobs**: Job tracking for scrape operations

## Image Download Flow

**Fast Method (Recommended):** Instagram CDN URLs are publicly accessible. Extract URLs from the profile grid and download directly via curl:

1. On profile page, use JS-eval action to `console.log` image URLs (some MCPs block URLs in return values, but console works)
2. Read URLs via the read-console action
3. Download images directly via `curl -o ./data/images/<username>/<shortcode>_0.jpg <url>`
4. Update DB with `bun run cli db update-post-image <shortcode> <path>`

**Legacy Method:** If direct URLs don't work:
1. Use canvas capture inside the browser (has session cookies)
2. Convert to dataURL and trigger download
3. Move file from Downloads to organized folder using `bun run cli images move-download`

```
./data/images/{username}/{shortcode}_0.jpg
```

## Browser MCP Setup

Two harnesses supported. Skills describe steps as **generic actions** (navigate, run-js, read-console, click, etc.); pick the row matching the MCP available in your session.

### Harness A — Claude Code with Claude-in-Chrome MCP
- Uses real Chrome with user's logged-in Instagram session.
- Extension must be installed and connected (see https://docs.claude.com/en/docs/claude-code/claude-in-chrome).
- Tool prefix: `mcp__claude-in-chrome__*`.

### Harness B — Any agent with Playwright MCP
- Spawns a managed browser. Login persists in the MCP profile across runs (first run requires manual login in the spawned browser; subsequent runs reuse storage state).
- Install: `npx @playwright/mcp@latest` or via the harness's MCP config.
- Tool prefix: `mcp__playwright__*`.

### Action → Tool Mapping

| Generic action | Claude-in-Chrome MCP | Playwright MCP |
|----------------|----------------------|----------------|
| List tabs | `tabs_context_mcp` | `browser_tabs` (action `list`) |
| New tab | `tabs_create_mcp` | `browser_tabs` (action `new`) |
| Close tab | `tabs_close_mcp` | `browser_tabs` (action `close`) |
| Navigate to URL | `navigate` | `browser_navigate` |
| Run JS in page | `javascript_tool` | `browser_evaluate` |
| Read console messages | `read_console_messages` | `browser_console_messages` |
| Read DOM / a11y snapshot | `read_page` | `browser_snapshot` |
| Click element | `find` (locate) + `javascript_tool` click, or `form_input` for fields | `browser_click` |
| Fill form field | `form_input` | `browser_type` / `browser_fill_form` |
| Press key | `shortcuts_execute` | `browser_press_key` |
| Network requests | `read_network_requests` | `browser_network_requests` |
| Screenshot | `get_screenshot` (none — use page screenshot tool) | `browser_take_screenshot` |
| Wait | (run JS `setTimeout` + poll) | `browser_wait_for` |

> Skill bodies use action verbs in **bold** (e.g., **navigate**, **run-js**, **read-console**). Translate via this table.

## Claude Skills

### /scrape-hashtag <name>

Discovers emerging artists from a hashtag page and scrapes their recent posts.

See `.claude/skills/scrape-hashtag.md` for the full workflow.

### /scrape-artist <username>

Scrapes a specific artist's profile and recent posts.

See `.claude/skills/scrape-artist.md` for the full workflow.

## Prerequisites

- An Instagram session must be logged in **for the harness in use**:
  - Claude-in-Chrome MCP: log into Instagram in your local Chrome (extension uses your real profile). Chrome required (not Brave — extension is Chrome-only).
  - Playwright MCP: log in once inside the spawned Playwright browser; the MCP persists storage state for later runs. If running headless, do an initial headed login first.
- Database schema pushed (`bun run db:push`).
- One of the browser MCPs configured (see **Browser MCP Setup** above).

## Agent Compatibility

This project uses **canonical files and symlinks** so any agent harness (Claude, Kimi, OpenCode, etc.) can discover context:

| Canonical Source | Symlink | Purpose |
|-----------------|---------|---------|
| `AGENTS.md` | `CLAUDE.md` | Agent context & project docs |
| `.agents/skills/` | `.claude/skills/` | Reusable skills & workflows |

**Convention:** Always edit the canonical source. The symlink follows automatically.
- Create new skills in `.agents/skills/` first, then add a symlink in `.claude/skills/`
- If an agent tool doesn't read `.agents/` natively, point it at the symlinked paths above

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
├── .agents/skills/         # Canonical skills (agent-neutral)
├── .claude/skills/         # Symlinked skills (for Claude Code)
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
- **Login required**: Log into Instagram in the harness's browser (real Chrome for Claude-in-Chrome; the spawned Playwright browser for Playwright MCP)
- **Rate limited**: Increase delays between requests
- **Claude-in-Chrome extension disconnected**: Restart Chrome and reconnect the MCP extension
- **Playwright MCP storage state lost**: Re-run a headed login; verify the MCP's user-data-dir is persistent across invocations
- **No qualifying artists**: Try different hashtags (see skill for recommendations)
