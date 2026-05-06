import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

const streamColors: Record<string, string> = {
  stdout: "text-zinc-300",
  stderr: "text-rose-300",
  system: "text-amber-300",
};

export function JobLogs({ jobId, live }: { jobId: number; live?: boolean }) {
  const { data, isLoading } = useQuery({
    queryKey: ["logs", jobId],
    queryFn: () => api.getJobLogs(jobId),
    refetchInterval: live ? 1500 : false,
  });
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [data?.lines.length]);

  if (isLoading) return <p className="text-muted text-xs">loading logs…</p>;
  const lines = data?.lines ?? [];
  if (lines.length === 0) {
    return <p className="text-muted text-xs">no logs captured (job may not have produced stdout yet)</p>;
  }
  return (
    <div
      ref={ref}
      className="bg-black border border-border rounded p-2 font-mono text-[11px] leading-tight max-h-72 overflow-auto whitespace-pre-wrap"
    >
      {lines.map((l, i) => (
        <div key={i} className={streamColors[l.stream] ?? "text-zinc-300"}>
          <span className="text-zinc-500 mr-2">{new Date(l.ts).toISOString().slice(11, 19)}</span>
          {l.line}
        </div>
      ))}
    </div>
  );
}
