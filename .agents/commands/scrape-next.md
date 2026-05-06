Drain the local scrape job queue.

Workflow:

1. Run `bun run cli job next` to claim the next pending row.
   - Prints `{"done":true,"pending":0}` → queue empty, stop and report "queue empty".
   - Prints `{"done":false,"job":{"id":<ID>,"jobType":"hashtag"|"artist","target":"<NAME>"},"remaining":<N>}` → row is now `running`. Note the `id`.

2. Branch on `jobType`:
   - **hashtag** → execute the workflow in `.claude/skills/scrape-hashtag.md` for `target`. Skip the `bun run cli job create` and `bun run cli job start` steps — the row is already created and started. Use the claimed `id` for all `bun run cli job progress <id> <count>`, `complete`, and `fail` calls.
   - **artist** → execute the workflow in `.claude/skills/scrape-artist.md` for `target`, same skip rule.

3. After the sub-workflow finishes:
   - Success: `bun run cli job complete <id> <total_items_scraped>`
   - Blocker (login wall, rate limit, etc.): `bun run cli job fail <id> "<short message>"`

4. Wait 5 seconds (rate limiting) and loop back to step 1. Continue until step 1 returns `done:true`.

5. When the queue is empty, print a one-line summary:
   `Drained N jobs · M completed · K failed · X new artists.`

Use the Claude-in-Chrome MCP for all browser actions (the user's logged-in Chrome session). Do not use Playwright.
