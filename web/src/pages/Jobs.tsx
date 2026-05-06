import { Fragment, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, relTime } from "../lib/api";
import { JobBadge } from "../components/JobBadge";
import { JobLogs } from "../components/JobLogs";

export function Jobs() {
  const qc = useQueryClient();
  const [openLogs, setOpenLogs] = useState<number | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: api.listJobs,
    refetchInterval: 5_000,
  });
  const cancel = useMutation({
    mutationFn: (jobId: number) => api.cancelJob(jobId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });

  const pendingCount = data?.queue.pending.length ?? 0;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Jobs</h1>
        <p className="text-sm text-muted">
          UI queues jobs; you drain them by running <code className="bg-surface-2 px-1 rounded">/scrape-next</code> in your Claude Code session.
        </p>
      </div>

      {pendingCount > 0 && (
        <div className="bg-emerald-100/70 dark:bg-emerald-950/40 border border-emerald-700/40 rounded p-3 text-sm">
          <p className="font-medium text-emerald-800 dark:text-emerald-200">
            {pendingCount} job{pendingCount === 1 ? "" : "s"} waiting.
          </p>
          <p className="text-emerald-700/80 dark:text-emerald-300/80 mt-1">
            Open Claude Code in this repo and run:
          </p>
          <pre className="mt-1 bg-surface-2/60 dark:bg-black/40 px-2 py-1 rounded font-mono text-xs">/scrape-next</pre>
        </div>
      )}

      <section>
        <h2 className="text-sm uppercase tracking-wide text-muted mb-2">Now</h2>
        {data?.queue.running ? (
          <div className="bg-panel border border-amber-500/40 rounded p-3 text-sm space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-amber-700 dark:text-amber-300 mr-2">running</span>
                <span className="font-mono">
                  {data.queue.running.jobType === "hashtag" ? "#" : "@"}
                  {data.queue.running.target}
                </span>
                <span className="text-muted ml-2">job #{data.queue.running.jobId}</span>
              </div>
              <button
                onClick={() => cancel.mutate(data.queue.running!.jobId)}
                disabled={cancel.isPending}
                className="text-xs px-2 py-1 rounded bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/40 dark:hover:bg-rose-900/60 dark:text-rose-200 disabled:opacity-50"
              >
                {cancel.isPending ? "cancelling…" : "cancel"}
              </button>
            </div>
            <JobLogs jobId={data.queue.running.jobId} live />
          </div>
        ) : (
          <p className="text-muted text-sm">idle</p>
        )}
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-wide text-muted mb-2">
          Queued ({data?.queue.pending.length ?? 0})
        </h2>
        {(data?.queue.pending.length ?? 0) === 0 ? (
          <p className="text-muted text-sm">empty</p>
        ) : (
          <ul className="space-y-1">
            {data!.queue.pending.map((q, i) => (
              <li key={q.jobId} className="text-sm bg-panel border border-border rounded px-3 py-2">
                <span className="text-muted mr-2">#{i + 1}</span>
                <span className="font-mono">
                  {q.jobType === "hashtag" ? "#" : "@"}
                  {q.target}
                </span>
                <span className="text-muted ml-2">job #{q.jobId}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-wide text-muted mb-2">Recent</h2>
        {isLoading ? (
          <p className="text-muted">Loading…</p>
        ) : (
          <div className="border border-border rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-panel text-xs uppercase text-muted">
                <tr>
                  <th className="text-left px-3 py-2">id</th>
                  <th className="text-left px-3 py-2">type</th>
                  <th className="text-left px-3 py-2">target</th>
                  <th className="text-left px-3 py-2">status</th>
                  <th className="text-left px-3 py-2">items</th>
                  <th className="text-left px-3 py-2">started</th>
                  <th className="text-left px-3 py-2">finished</th>
                </tr>
              </thead>
              <tbody>
                {data?.rows.map((j) => (
                  <Fragment key={j.id}>
                    <tr className="border-t border-border align-top hover:bg-panel/40">
                      <td className="px-3 py-2 text-muted">#{j.id}</td>
                      <td className="px-3 py-2">{j.jobType}</td>
                      <td className="px-3 py-2 font-mono">
                        {j.jobType === "hashtag" ? "#" : "@"}
                        {j.target}
                      </td>
                      <td className="px-3 py-2">
                        <JobBadge status={j.status} />
                        {j.errorMessage && (
                          <p className="mt-1 text-xs text-rose-700 dark:text-rose-300 max-w-md whitespace-pre-line">
                            {j.errorMessage}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2">{j.itemsScraped ?? 0}</td>
                      <td className="px-3 py-2 text-muted">{relTime(j.startedAt)}</td>
                      <td className="px-3 py-2 text-muted">
                        {relTime(j.completedAt)}
                        <button
                          onClick={() => setOpenLogs(openLogs === j.id ? null : j.id)}
                          className="ml-2 text-[10px] underline text-muted hover:text-fg"
                        >
                          {openLogs === j.id ? "hide logs" : "logs"}
                        </button>
                      </td>
                    </tr>
                    {openLogs === j.id && (
                      <tr>
                        <td colSpan={7} className="px-3 py-2 bg-surface-2/60 dark:bg-black/40">
                          <JobLogs jobId={j.id} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
