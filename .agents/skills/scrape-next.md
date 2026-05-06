# Scrape Next Skill

## Usage
```
/scrape-next
```

Drains the scrape job queue created by the local UI (`bun run dev`).

## Why this exists

The UI (`bun run dev`) lets the user mark hashtags as tracked, click "Run all tracked", or trigger one-off scrapes per artist. Each click inserts a `pending` row into the `scrape_jobs` SQLite table — it does **not** spawn a subprocess. The user runs this skill in their own Claude Code session so the same Claude instance that owns the Claude-in-Chrome MCP connection (and is therefore logged into Instagram via their real Chrome) can do the actual scraping.

## Workflow

### 1. Claim the next pending job

```bash
bun run cli job next
```

The CLI prints one of:

- `{"done":true,"pending":0}` — queue is empty. Stop. Tell the user no work to do.
- `{"done":false,"job":{"id":42,"jobType":"hashtag","target":"oilpainting"},"remaining":3}` — a job has been claimed (status flipped from `pending` → `running` automatically) and 3 more rows remain after this one.

Note the `id` and `target`. **Set `INSTASCRAPER_JOB_ID=<id>` mentally for sub-skills** — the sub-skill instructions check for this env var to skip job creation. Since you're running interactively (not via subprocess), the env var will not be set; instead, just **pass the id directly** to `bun run cli job progress <id> <count>`, `job complete`, and `job fail` calls inside the sub-skill.

### 2. Run the appropriate sub-skill

Branch on `jobType`:

- **hashtag** → follow `.claude/skills/scrape-hashtag.md` for `target`, but skip the `job create` and `job start` steps (the row already exists and is already started). Use the claimed `id` in all `job progress`/`complete`/`fail` calls.
- **artist** → follow `.claude/skills/scrape-artist.md` for `target`, same skip rule.

### 3. Mark the job complete

When the sub-skill finishes successfully:

```bash
bun run cli job complete <id> <total_items_scraped>
```

If something blocks (login wall, rate limit, network error, etc.):

```bash
bun run cli job fail <id> "<short error message>"
```

### 4. Loop

After the sub-skill finishes (success or fail), go back to step 1 and claim the next pending job. Continue until `bun run cli job next` reports `done:true`.

### 5. Summarize

When the queue is empty, post a brief summary to the user:

> Drained N jobs. M completed, K failed. New artists discovered: X.

Hand back control. Don't re-poll — the user will run `/scrape-next` again when they queue more work.

## Rate limiting

Wait at least 5 seconds between consecutive jobs. Instagram may flag rapid-fire scrapes. The sub-skills already include their own per-post delays.

## When NOT to use this

- If `bun run cli job pending` prints `{"pending":0}`, there's nothing to do.
- If the user wants a one-off scrape on a specific tag/artist that is **not** queued via the UI, use `/scrape-hashtag <name>` or `/scrape-artist <username>` directly.
