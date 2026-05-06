type Listener = (event: AppEvent) => void;

export type AppEvent =
  | { type: "job.update"; jobId: number }
  | { type: "job.log"; jobId: number; line: string; stream: "stdout" | "stderr" }
  | { type: "queue.update" };

const listeners = new Set<Listener>();

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emit(event: AppEvent): void {
  for (const fn of listeners) {
    try {
      fn(event);
    } catch (err) {
      console.error("[events] listener error:", err);
    }
  }
}
