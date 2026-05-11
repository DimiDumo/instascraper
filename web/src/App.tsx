import { NavLink, Route, Routes } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Artists } from "./pages/Artists";
import { ArtistDetail } from "./pages/ArtistDetail";
import { Tags } from "./pages/Tags";
import { Jobs } from "./pages/Jobs";
import { Prompts } from "./pages/Prompts";
import { useJobEvents } from "./lib/sse";
import { api } from "./lib/api";
import { ThemeToggle } from "./components/ThemeToggle";
import { CloudModeBanner } from "./components/CloudModeBanner";
import { ModeContext, useMode } from "./lib/mode";

function NavBadge() {
  // Pull queue from local server only when reachable; cloud has no concept of a live queue.
  const { mode } = useMode();
  const { data } = useQuery({
    queryKey: ["queue"],
    queryFn: api.getQueueState,
    refetchInterval: 10_000,
    enabled: mode === "local-agent",
  });
  if (!data) return null;
  const active = data.running ? 1 : 0;
  const queued = data.pending.length;
  if (active + queued === 0) return null;
  return (
    <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300">
      {active + queued}
    </span>
  );
}

export function App() {
  const modeState = useMode();
  useJobEvents();
  return (
    <ModeContext.Provider value={modeState}>
      <div className="flex flex-col h-full">
        <CloudModeBanner />
        <div className="flex flex-1 min-h-0">
          <aside className="w-52 border-r border-border bg-panel flex-shrink-0 p-4 flex flex-col gap-1">
            <h1 className="text-base font-semibold mb-4 px-2">
              <span className="text-accent">●</span> instascraper
            </h1>
            <NavItem to="/">Artists</NavItem>
            <NavItem to="/tags">Hashtags</NavItem>
            <NavItem to="/prompts">Prompts</NavItem>
            <NavItem to="/jobs">
              Jobs <NavBadge />
            </NavItem>
            <div className="mt-auto pt-4 border-t border-border space-y-2 px-2">
              <ThemeToggle />
              <div className="text-[11px] text-muted">
                {modeState.mode === "local-agent"
                  ? "local-agent connected"
                  : modeState.mode === "cloud-only"
                    ? "cloud mode"
                    : "checking…"}
              </div>
            </div>
          </aside>
          <main className="flex-1 overflow-auto p-6">
            <Routes>
              <Route path="/" element={<Artists />} />
              <Route path="/artists/:username" element={<ArtistDetail />} />
              <Route path="/tags" element={<Tags />} />
              <Route path="/prompts" element={<Prompts />} />
              <Route path="/jobs" element={<Jobs />} />
            </Routes>
          </main>
        </div>
      </div>
    </ModeContext.Provider>
  );
}

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        `px-2 py-1.5 rounded text-sm flex items-center ${
          isActive ? "bg-surface-2 text-fg" : "text-fg-soft hover:text-fg hover:bg-surface-2/50"
        }`
      }
    >
      {children}
    </NavLink>
  );
}
