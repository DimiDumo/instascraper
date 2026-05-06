import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

/** Subscribe to /events/jobs once. Invalidates job + queue + artist queries on each event. */
export function useJobEvents() {
  const qc = useQueryClient();
  useEffect(() => {
    const es = new EventSource("/events/jobs");
    es.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data?.type === "job.update" || data?.type === "queue.update") {
          qc.invalidateQueries({ queryKey: ["jobs"] });
          qc.invalidateQueries({ queryKey: ["tags"] });
          qc.invalidateQueries({ queryKey: ["artists"] });
        }
      } catch {
        /* ignore */
      }
    };
    es.onerror = () => {
      // EventSource auto-reconnects; nothing to do.
    };
    return () => es.close();
  }, [qc]);
}
