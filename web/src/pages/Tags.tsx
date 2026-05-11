import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, relTime } from "../lib/api";
import { useCurrentMode } from "../lib/mode";

export function Tags() {
  const qc = useQueryClient();
  const [newTag, setNewTag] = useState("");
  const { mode } = useCurrentMode();
  const localOnly = mode !== "local-agent";
  const { data, isLoading } = useQuery({
    queryKey: ["tags"],
    queryFn: api.listTags,
  });

  const toggle = useMutation({
    mutationFn: (vars: { name: string; isTracked: boolean }) =>
      api.setTagTracked(vars.name, vars.isTracked),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags"] }),
  });

  const add = useMutation({
    mutationFn: (name: string) => api.createTag(name, true),
    onSuccess: () => {
      setNewTag("");
      qc.invalidateQueries({ queryKey: ["tags"] });
    },
  });

  const scrape = useMutation({
    mutationFn: (name: string) => api.scrapeHashtag(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });

  const runTracked = useMutation({
    mutationFn: api.runTracked,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });

  const tracked = data?.rows.filter((t) => t.isTracked) ?? [];
  const untracked = data?.rows.filter((t) => !t.isTracked) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Hashtags</h1>
          <p className="text-sm text-muted">{tracked.length} tracked · {untracked.length} known</p>
        </div>
        <button
          onClick={() => runTracked.mutate()}
          disabled={tracked.length === 0 || runTracked.isPending || localOnly}
          title={localOnly ? "Connect local scraper to run" : undefined}
          className="px-4 py-2 rounded bg-accent text-black font-medium text-sm hover:bg-accent/90 disabled:opacity-40"
        >
          {runTracked.isPending ? "queueing…" : `Run all tracked (${tracked.length})`}
        </button>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const name = newTag.trim().replace(/^#/, "");
          if (name) add.mutate(name);
        }}
      >
        <input
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          placeholder="add hashtag (no #)"
          className="bg-panel border border-border rounded px-3 py-1.5 text-sm flex-1 max-w-xs focus:outline-none focus:border-muted"
        />
        <button className="px-3 py-1.5 rounded bg-surface-2 hover:bg-surface-3 text-sm" type="submit">
          add tracked
        </button>
      </form>

      {isLoading ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <>
          <Section title="Tracked" hint="Included in 'Run all tracked'">
            <TagTable
              rows={tracked}
              onToggle={(t) => toggle.mutate({ name: t.name, isTracked: false })}
              onScrape={(t) => scrape.mutate(t.name)}
              disableScrape={localOnly}
              trackedColumn
            />
          </Section>
          <Section title="Discovered (not tracked)" hint="Hashtags found inside scraped posts. Toggle to include in daily run.">
            <TagTable
              rows={untracked}
              onToggle={(t) => toggle.mutate({ name: t.name, isTracked: true })}
              onScrape={(t) => scrape.mutate(t.name)}
              disableScrape={localOnly}
            />
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-medium">{title}</h2>
      {hint && <p className="text-xs text-muted mb-2">{hint}</p>}
      {children}
    </section>
  );
}

function TagTable({
  rows,
  onToggle,
  onScrape,
  trackedColumn,
  disableScrape,
}: {
  rows: Array<{ id: number; name: string; lastScrapedAt: string | null; linkedPosts: number; isTracked: boolean }>;
  onToggle: (t: { name: string }) => void;
  onScrape: (t: { name: string }) => void;
  trackedColumn?: boolean;
  disableScrape?: boolean;
}) {
  if (rows.length === 0) return <p className="text-muted text-sm py-2">none</p>;
  return (
    <div className="border border-border rounded overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-panel text-xs uppercase text-muted">
          <tr>
            <th className="text-left px-3 py-2">name</th>
            <th className="text-left px-3 py-2">posts in db</th>
            <th className="text-left px-3 py-2">last scraped</th>
            <th className="text-right px-3 py-2">actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className="border-t border-border hover:bg-panel/60">
              <td className="px-3 py-2 font-mono">#{t.name}</td>
              <td className="px-3 py-2">{t.linkedPosts}</td>
              <td className="px-3 py-2 text-muted">{relTime(t.lastScrapedAt)}</td>
              <td className="px-3 py-2 text-right space-x-2">
                <button
                  onClick={() => onScrape(t)}
                  disabled={disableScrape}
                  title={disableScrape ? "Connect local scraper to scrape" : undefined}
                  className="text-xs px-2 py-1 rounded bg-surface-2 hover:bg-surface-3 disabled:opacity-40"
                >
                  scrape
                </button>
                <button
                  onClick={() => onToggle(t)}
                  className={`text-xs px-2 py-1 rounded ${
                    trackedColumn
                      ? "bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/40 dark:hover:bg-rose-900/60 dark:text-rose-200"
                      : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:hover:bg-emerald-900/60 dark:text-emerald-200"
                  }`}
                >
                  {trackedColumn ? "untrack" : "track"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
