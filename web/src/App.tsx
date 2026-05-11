import { NavLink, Route, Routes } from "react-router-dom";
import { Artists } from "./pages/Artists";
import { ArtistDetail } from "./pages/ArtistDetail";
import { Tags } from "./pages/Tags";
import { Jobs } from "./pages/Jobs";
import { Prompts } from "./pages/Prompts";
import { useJobEvents } from "./lib/sse";
import { useQuery } from "@tanstack/react-query";
import { api } from "./lib/api";
import { ThemeToggle } from "./components/ThemeToggle";

function NavBadge() {
  const { data } = useQuery({ queryKey: ["jobs"], queryFn: api.listJobs, refetchInterval: 10_000 });
  const active = data?.queue.running ? 1 : 0;
  const queued = data?.queue.pending.length ?? 0;
  if (active + queued === 0) return null;
  return (
    <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300">
      {active + queued}
    </span>
  );
}

export function App() {
  useJobEvents();
  return (
    <div className="flex h-full">
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
          <div className="text-[11px] text-muted">local-only</div>
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
