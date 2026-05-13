import type { DmStatus } from "./api";

export const DM_STATUSES: readonly DmStatus[] = ["none", "draft", "synced", "ready", "sent"];

export const DM_STATUS_LABEL: Record<DmStatus, string> = {
  none: "no DM",
  draft: "draft",
  synced: "synced",
  ready: "ready",
  sent: "sent",
};

export const DM_STATUS_BADGE: Record<DmStatus, string> = {
  none: "bg-surface-2 text-muted",
  draft: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
  synced: "bg-sky-500/20 text-sky-700 dark:text-sky-300",
  ready: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  sent: "bg-violet-500/20 text-violet-700 dark:text-violet-300",
};
