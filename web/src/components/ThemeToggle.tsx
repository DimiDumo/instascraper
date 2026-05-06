import { useEffect, useState } from "react";

type Mode = "system" | "light" | "dark";

function readMode(): Mode {
  try {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* ignore */
  }
  return "system";
}

function applyMode(mode: Mode) {
  const resolved =
    mode === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : mode;
  document.documentElement.setAttribute("data-theme", resolved);
  try {
    if (mode === "system") localStorage.removeItem("theme");
    else localStorage.setItem("theme", mode);
  } catch {
    /* ignore */
  }
}

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>(readMode);

  useEffect(() => {
    applyMode(mode);
  }, [mode]);

  useEffect(() => {
    if (mode !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyMode("system");
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [mode]);

  const options: Array<{ value: Mode; label: string }> = [
    { value: "system", label: "auto" },
    { value: "light", label: "light" },
    { value: "dark", label: "dark" },
  ];

  return (
    <div className="flex rounded border border-border overflow-hidden text-[11px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => setMode(o.value)}
          className={`flex-1 px-2 py-1 transition-colors ${
            mode === o.value
              ? "bg-accent text-white"
              : "text-fg-soft hover:text-fg hover:bg-surface-2/50"
          }`}
          aria-pressed={mode === o.value}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
