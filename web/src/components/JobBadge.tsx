import type { Job } from "../lib/api";

const styles: Record<Job["status"], string> = {
  pending: "bg-surface-2/60 text-fg-soft",
  running: "bg-amber-500/20 text-amber-700 dark:text-amber-300 animate-pulse",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  failed: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
};

export function JobBadge({ status }: { status: Job["status"] }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}
