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

- **Runtime**: Bun (local CLI + local Hono server) + Cloudflare Workers (cloud API)
- **Language**: TypeScript
- **Database**: Cloudflare D1 (SQLite-compatible) with Drizzle ORM
- **Object storage**: Cloudflare R2 (images, S3-compatible API)
- **Auth**: Cloudflare Access (Zero Trust) — browser SSO + service tokens for CLI
- **Web UI**: React + Vite, deployed to Cloudflare Pages
- **Browser Automation**: Either **Claude-in-Chrome MCP** (Claude Code only) or **Playwright MCP** (any agent harness)
- **CLI**: Commander.js

## Architecture

Data lives in Cloudflare. Scraping orchestration runs locally on the user's laptop (it needs the logged-in Chrome session + `claude` subprocess for agents).

```
Browser (any device) ── CF Access SSO ──> reo.gallerytalk.io
                                              ├── /*       Pages (web UI)
                                              └── /api/*   Worker (D1 + R2)

Local laptop (only when scraping):
  Hono server :3737           Job queue + agent subprocess + SSE
  CLI ── HTTPS ──> Worker     save-artist / save-post / job updates
  CLI ── S3 ─────> R2 bucket  Direct image uploads (skips Worker hop)
```

The web app polls `http://localhost:3737/api/health` to detect whether the local scraper is reachable. When reachable → "local-agent" mode, scrape/generation buttons enabled. When unreachable → "cloud mode" banner, those buttons disabled (data is still viewable).

## Quick Start

```bash
# Install root + cloud + web dependencies
bun install
(cd cloud && bun install)
(cd web && bun install)

# Populate .env (root) — see .env.example for required keys:
#   CLOUD_API_URL, CF_ACCESS_CLIENT_ID/SECRET, R2_ACCOUNT_ID/ACCESS_KEY/SECRET/BUCKET
# Populate web/.env (VITE_CLOUD_API_URL, VITE_LOCAL_API_URL).

# Run local orchestration server + web dev server
bun run dev

# Deploy cloud Worker (after CF Access app set up — see Cloud setup below)
bun run cloud:deploy

# Apply DB migrations to D1
bun run cloud:migrations:apply
```

## Cloud setup

One-time bootstrap (mostly via Cloudflare dashboard since wrangler can't configure CF Access yet).

### 1. Resources (already created)
- D1 database `instascraper-db` — id `0f5305c6-5cdf-4a5d-bb57-a9f5893d0be3`
- R2 bucket `instascraper-images`
- `cloud/wrangler.toml` is pre-wired to both

### 2. DNS + custom domain (manual, Cloudflare dashboard)
- Cloudflare dashboard → **DNS** for `gallerytalk.io` → add `reo` CNAME → `<account>.workers.dev` (proxied). Wrangler will attach Worker to `/api/*` on first deploy via the `routes` entry in `wrangler.toml`.
- Cloudflare Pages → Create project → connect this repo → root directory `web/` → build command `bun run build` → output `dist`. After first deploy, **Custom domains** → add `reo.gallerytalk.io`.

### 3. Cloudflare Access application (manual)
- Cloudflare dashboard → **Zero Trust** → **Access** → **Applications** → **Add** → Self-hosted.
- Application domain: `reo.gallerytalk.io` (covers both Pages and Worker since they share the host).
- Policy: allow specific emails (you + invitees). Identity provider: email OTP or Google.
- After save, copy the **Application Audience (AUD) Tag** — set it as a Worker secret:
  ```bash
  cd cloud && wrangler secret put CF_ACCESS_AUD   # paste the AUD tag
  ```
- Also update `cloud/wrangler.toml` `CF_ACCESS_TEAM_DOMAIN` (e.g. `dimitri.cloudflareaccess.com`).

### 4. Service Token for local CLI (manual)
- **Zero Trust** → **Access** → **Service Auth** → **Create Service Token** named `instascraper-local-cli`.
- Add a policy on the Access application that **includes** this service token (so CLI calls bypass the SSO login flow).
- Copy Client ID + Secret into local `.env` as `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET`.

### 5. R2 S3 credentials for local CLI (manual)
- Cloudflare dashboard → **R2** → **Manage API tokens** → **Create API token** → Object Read & Write on the bucket.
- Copy Account ID + Access Key ID + Secret Access Key into local `.env` as `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`.

### 6. Apply schema and deploy
```bash
bun run cloud:migrations:apply   # writes the 0000_init.sql to D1
bun run cloud:deploy             # publishes Worker, attaches to reo.gallerytalk.io/api/*
```

## Workflow Overview

1. **Start from hashtag** (e.g., `#oilpainting`, `#emergingartist`) to discover artists
2. **Evaluate each artist** with AI against qualification criteria (followers, bio, content)
3. **Scrape recent posts** per qualifying artist using the fast grid method (~10 posts for hashtag flow, up to 50 for dedicated artist scrapes)
4. **Upload artwork images** to R2 via the CLI (`bun run cli images upload`)
5. **Link everything** in Cloudflare D1 for later outreach/curation

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
# Cloud data operations (all hit the Worker → D1)
bun run cli db save-artist '<json>'         # Save artist profile
bun run cli db save-post   '<json>'         # Save post with images/hashtags

# Image operations (R2 upload via S3 API, then patches D1 with the key)
bun run cli images upload -u <url> -a <artist> -s <shortcode> -i <index>

# Job tracking (mirrors state in D1 scrape_jobs)
bun run cli job create hashtag <name>
bun run cli job create artist  <username>
bun run cli job start    <id>
bun run cli job progress <id> <count>
bun run cli job complete <id> <count>
bun run cli job fail     <id> "<error>"
bun run cli job list
bun run cli job next     # claim oldest pending row, flip to running
bun run cli job pending  # JSON count of pending rows
```

## Database Schema (Cloudflare D1)

- **artists**: Emerging artist profiles (username, bio, followers, `profile_pic_key`)
- **posts**: Individual posts linked to artists, with `image_key` referencing the R2 object
- **images**: Individual images from posts (URL, `r2_key`, dimensions, download status)
- **hashtags**: Tracked hashtags with post counts and `is_tracked` flag
- **post_hashtags**: Junction table linking posts to hashtags
- **scrape_jobs**: Job tracking for scrape operations
- **prompts**: Reusable generation/cleanup templates
- **generations**: Per-artist DM outputs (run locally, persisted to D1)

## Image Upload Flow

Instagram CDN URLs are publicly accessible. The scraper grabs URLs from the profile grid, then the CLI uploads each one to R2 in a single hop:

1. On profile page, use JS-eval action to `console.log` image URLs (some MCPs block URLs in return values, but console works)
2. Read URLs via the read-console action
3. For each URL: `bun run cli images upload --url "<url>" --artist "<username>" --shortcode "<shortcode>" --index <n>`
   - Downloads CDN bytes
   - PUTs to R2 under `<username>/<shortcode>_<n>.<ext>`
   - Updates the post row's `imageKey` (or artist row's `profilePicKey` when shortcode is `profile`) in D1 via the Worker

Web viewers fetch images via `reo.gallerytalk.io/api/images/<key>` — same origin as the Pages app, so the CF Access cookie covers `<img>` requests.

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
- Cloud bootstrapped (see **Cloud setup** above) and local `.env` populated with `CLOUD_API_URL`, `CF_ACCESS_CLIENT_ID/SECRET`, `R2_*`.
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
│   ├── cloud/
│   │   ├── client.ts       # Typed HTTPS client → cloud Worker
│   │   └── r2.ts           # R2 S3 PUT helpers (aws4fetch)
│   ├── commands/
│   │   ├── save-artist.ts  # Upsert via Worker
│   │   ├── save-post.ts    # Upsert via Worker
│   │   ├── download-image.ts # Download CDN → R2 PUT → D1 patch
│   │   └── job-status.ts   # Job CRUD via Worker
│   ├── services/
│   │   ├── generate.ts     # Local subprocess → cloud generation row
│   │   └── refine.ts       # Local subprocess → cloud prompt rewrite
│   └── index.ts            # CLI entry point (commander)
├── server/                 # Local Hono — orchestration only
│   ├── index.ts            # /api/health, /events/jobs, route mount
│   ├── routes/             # jobs (scrape-*, cancel, run-tracked), prompts/:id/refine, generations POST, logs/:id
│   ├── services/           # job queue, job runner, SSE bus, log buffer
│   └── agents/             # spawn `claude` subprocess for scrapes
├── cloud/                  # Cloudflare Worker (D1 + R2 data plane)
│   ├── src/
│   │   ├── db/             # Drizzle schema + queries (D1 dialect)
│   │   ├── routes/         # artists, posts, tags, jobs, prompts, generations, images
│   │   ├── middleware/access.ts  # CF Access JWT verification
│   │   └── index.ts        # Hono entry, mounts routes
│   ├── migrations/         # Drizzle-generated SQL applied via wrangler
│   ├── wrangler.toml       # D1 + R2 bindings, route on reo.gallerytalk.io/api/*
│   └── drizzle.config.ts
├── web/                    # React + Vite, deployed to Cloudflare Pages
│   ├── src/
│   │   ├── lib/api.ts      # Split cloud/local fetch
│   │   ├── lib/mode.ts     # Local-agent reachability detection
│   │   └── components/CloudModeBanner.tsx
│   └── vite.config.ts
├── .agents/skills/         # Canonical skills (agent-neutral)
└── .claude/skills/         # Symlinked skills (for Claude Code)
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
- **`401 invalid Access JWT` from Worker**: rotate or recreate the Service Token; verify `CF_ACCESS_CLIENT_ID`/`SECRET` in local `.env` match the token in CF dashboard.
- **`R2 PUT … 401`**: R2 API token may be missing Object Write on the bucket. Recreate via Cloudflare → R2 → Manage API tokens.
- **Worker returns `503 CF Access not configured`**: `CF_ACCESS_AUD` secret missing or `CF_ACCESS_TEAM_DOMAIN` still `REPLACE_ME` in `cloud/wrangler.toml`.
