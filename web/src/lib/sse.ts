import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { jobEventsUrl } from "./api";
import { useCurrentMode } from "./mode";

/**
 * Subscribe to /events/jobs on the local Hono server. Only runs when the local
 * agent is reachable — in cloud-only mode there is no live event stream.
 */
export function useJobEvents() {
  const qc = useQueryClient();
  const { mode } = useCurrentMode();
  useEffect(() => {
    if (mode !== "local-agent") return;
    const es = new EventSource(jobEventsUrl());
    es.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data?.type === "job.update" || data?.type === "queue.update") {
          qc.invalidateQueries({ queryKey: ["jobs"] });
          qc.invalidateQueries({ queryKey: ["queue"] });
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
  }, [qc, mode]);
}
