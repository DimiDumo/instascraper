# Scrape Next Skill

## Usage
```
/scrape-next
```

Drains the scrape job queue created by the local UI (`bun run dev`).

## Why this exists

The UI (`bun run dev`) lets the user mark hashtags as tracked, click "Run all tracked", or trigger one-off scrapes per artist. Each click inserts a `pending` row into the `scrape_jobs` SQLite table — it does **not** spawn a subprocess. The user runs this skill in their own Claude Code session so the same Claude instance that owns the Claude-in-Chrome MCP connection (and is therefore logged into Instagram via their real Chrome) can do the actual scraping.

## Context-isolation design

Per-artist work is delegated to the **`artist-scraper`** subagent (defined in `.agents/agents/artist-scraper.md`). Main thread keeps only orchestration — job claim, hashtag discovery loop, AI qualification, complete/fail. The subagent handles profile extraction, the Fast Grid Method, all `save-post` calls, all R2 uploads, and `job progress` ticks. Only a single JSON line comes back into main context per artist (~200 bytes vs. ~50–80KB inline). Sequential only — never spawn two subagents in parallel (Instagram bot detection).

## Workflow

### 1. Claim the next pending job

```bash
bun run cli job next
```

The CLI prints one of:

- `{"done":true,"pending":0}` — queue empty. Stop. Tell the user no work to do.
- `{"done":false,"job":{"id":42,"jobType":"hashtag","target":"oilpainting"},"remaining":3}` — claimed (status flipped `pending` → `running` automatically), 3 more rows remain after this one.

Note the `id` and `target`. Pass `id` directly to all `bun run cli job progress|complete|fail` calls (interactive runs don't have `INSTASCRAPER_JOB_ID` set).

### 2. Dispatch by jobType

#### `artist` — delegate to subagent

Spawn one `artist-scraper` subagent and pass the contract in the prompt:

```
Agent({
  subagent_type: "artist-scraper",
  description: "Scrape <username>",
  prompt: "username: <target>\njob_id: <id>\nmax_posts: 10\nmcp: claude-in-chrome"  // or "playwright"
})
```

When the subagent returns, parse the final JSON line. Then:

- `{"ok":true, "postsScraped":N, ...}` → `bun run cli job complete <id> <N>`
- `{"ok":false, ..., "error":"..."}` → `bun run cli job fail <id> "<error>"`

Do **not** call `job create` / `job start` — the row is already claimed and running.

#### `hashtag` — follow scrape-hashtag.md

Follow `.claude/skills/scrape-hashtag.md` for `target`, but skip its `job create` / `job start` (the row is already running). That skill itself spawns one `artist-scraper` subagent per qualifying artist. Use the claimed `id` for all `job progress` / `complete` / `fail` calls.

### 3. Wait between jobs

After the sub-skill (or direct subagent call) finishes — success or fail — sleep 5 seconds before claiming the next job:

```bash
sleep 5
```

Instagram may flag rapid-fire scrapes. The per-post delays inside the subagent are separate.

### 4. Loop

Go back to step 1 and claim the next pending job. Continue until `bun run cli job next` reports `done:true`.

### 5. Summarize

When the queue is empty, post a brief summary:

> Drained N jobs. M completed, K failed. New artists discovered: X.

Hand back control. Don't re-poll — the user will run `/scrape-next` again when they queue more work.

## When NOT to use this

- If `bun run cli job pending` prints `{"pending":0}`, nothing to do.
- For a one-off scrape on a specific tag/artist **not** queued via the UI, run `/scrape-hashtag <name>` or `/scrape-artist <username>` directly.
