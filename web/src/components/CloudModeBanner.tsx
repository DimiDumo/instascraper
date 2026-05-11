import { useCurrentMode } from "../lib/mode";

export function CloudModeBanner() {
  const { mode } = useCurrentMode();
  if (mode !== "cloud-only") return null;
  return (
    <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-200 text-sm px-4 py-2 flex items-center gap-3">
      <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
      <span>
        <strong>Cloud mode</strong> — scraper not reachable on this device. Browse data, but
        scrape and generation actions require the local agent (run <code>bun run dev</code> on
        your scraper laptop).
      </span>
    </div>
  );
}
