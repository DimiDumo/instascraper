import { createContext, useContext, useEffect, useState } from "react";

const LOCAL_API = (import.meta.env.VITE_LOCAL_API_URL as string | undefined)?.replace(/\/$/, "") ?? "http://localhost:3737";

export type Mode = "local-agent" | "cloud-only" | "unknown";

export interface ModeState {
  mode: Mode;
  lastChecked: number;
}

async function probe(): Promise<Mode> {
  try {
    const res = await fetch(`${LOCAL_API}/api/health`, {
      method: "GET",
      signal: AbortSignal.timeout(800),
    });
    if (!res.ok) return "cloud-only";
    const body = (await res.json().catch(() => null)) as { mode?: string } | null;
    return body?.mode === "local-agent" ? "local-agent" : "cloud-only";
  } catch {
    return "cloud-only";
  }
}

export function useMode(pollMs = 30_000): ModeState {
  const [state, setState] = useState<ModeState>({ mode: "unknown", lastChecked: 0 });
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const mode = await probe();
      if (alive) setState({ mode, lastChecked: Date.now() });
    };
    tick();
    const id = setInterval(tick, pollMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [pollMs]);
  return state;
}

export const ModeContext = createContext<ModeState>({ mode: "unknown", lastChecked: 0 });

export function useCurrentMode() {
  return useContext(ModeContext);
}

export function isCloudOnly(state: ModeState): boolean {
  return state.mode === "cloud-only";
}
