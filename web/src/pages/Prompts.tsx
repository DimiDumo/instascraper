import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, relTime, type Prompt, type PromptKind } from "../lib/api";

export function Prompts() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["prompts"],
    queryFn: api.listPrompts,
  });

  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<PromptKind>("generate");

  const create = useMutation({
    mutationFn: () => api.createPrompt(name.trim(), body.trim(), kind),
    onSuccess: () => {
      setName("");
      setBody("");
      setKind("generate");
      qc.invalidateQueries({ queryKey: ["prompts"] });
    },
  });

  const rows = data?.rows ?? [];
  // Latest-updated cleanup prompt is the one auto-chained server-side.
  const activeCleanupId =
    rows.filter((r) => r.kind === "cleanup")[0]?.id ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Prompts</h1>
        <p className="text-sm text-muted">
          Reusable templates fed to Claude. <strong>Generate</strong> prompts produce a DM from artist data;
          the latest-updated <strong>Cleanup</strong> prompt then auto-runs to scrub the result (e.g. strip em-dashes).
        </p>
      </div>

      <form
        className="border border-border rounded p-4 space-y-3 bg-panel/40"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && body.trim()) create.mutate();
        }}
      >
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs uppercase text-muted block mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Warm Instagram DM"
              className="bg-panel border border-border rounded px-3 py-1.5 text-sm w-full focus:outline-none focus:border-muted"
            />
          </div>
          <div>
            <label className="text-xs uppercase text-muted block mb-1">Kind</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as PromptKind)}
              className="bg-panel border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-muted"
            >
              <option value="generate">generate</option>
              <option value="cleanup">cleanup</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs uppercase text-muted block mb-1">Instructions</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              kind === "cleanup"
                ? "Rewrite the DM below to strip em-dashes (—) and replace with commas, dashes, or new sentences. Preserve voice, length, line breaks. Do NOT change wording otherwise."
                : "Look at the artist's bio, captions, and artwork. Write a friendly 2-3 sentence Instagram DM inviting them to try GalleryTalk.io - a virtual 3D gallery for artists. Reference one specific detail from their work."
            }
            rows={6}
            className="bg-panel border border-border rounded px-3 py-2 text-sm w-full font-mono focus:outline-none focus:border-muted"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!name.trim() || !body.trim() || create.isPending}
            className="px-4 py-1.5 rounded bg-accent text-black font-medium text-sm hover:bg-accent/90 disabled:opacity-40"
          >
            {create.isPending ? "saving…" : "Add prompt"}
          </button>
        </div>
      </form>

      {isLoading ? (
        <p className="text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted text-sm">No prompts yet — create your first above.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((p) => (
            <PromptRow key={p.id} prompt={p} isActiveCleanup={p.id === activeCleanupId} />
          ))}
        </div>
      )}
    </div>
  );
}

function PromptRow({ prompt, isActiveCleanup }: { prompt: Prompt; isActiveCleanup: boolean }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(prompt.name);
  const [body, setBody] = useState(prompt.body);
  const [kind, setKind] = useState<PromptKind>(prompt.kind);

  const update = useMutation({
    mutationFn: () => api.updatePrompt(prompt.id, { name: name.trim(), body, kind }),
    onSuccess: () => {
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["prompts"] });
    },
  });

  const del = useMutation({
    mutationFn: () => api.deletePrompt(prompt.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prompts"] }),
  });

  const undo = useMutation({
    mutationFn: () => api.undoPrompt(prompt.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prompts"] }),
  });

  if (editing) {
    return (
      <div className="border border-border rounded p-4 space-y-3 bg-panel/40">
        <div className="flex gap-3 flex-wrap">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-panel border border-border rounded px-3 py-1.5 text-sm flex-1 min-w-[200px] focus:outline-none focus:border-muted"
          />
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as PromptKind)}
            className="bg-panel border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-muted"
          >
            <option value="generate">generate</option>
            <option value="cleanup">cleanup</option>
          </select>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={Math.max(4, Math.min(12, body.split("\n").length + 1))}
          className="bg-panel border border-border rounded px-3 py-2 text-sm w-full font-mono focus:outline-none focus:border-muted"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={() => {
              setName(prompt.name);
              setBody(prompt.body);
              setKind(prompt.kind);
              setEditing(false);
            }}
            className="text-xs px-3 py-1.5 rounded bg-surface-2 hover:bg-surface-3"
          >
            cancel
          </button>
          <button
            onClick={() => update.mutate()}
            disabled={!name.trim() || !body.trim() || update.isPending}
            className="text-xs px-3 py-1.5 rounded bg-accent/80 text-black hover:bg-accent disabled:opacity-40"
          >
            {update.isPending ? "saving…" : "save"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border rounded p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{prompt.name}</h3>
            <span
              className={
                prompt.kind === "cleanup"
                  ? "text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-700 dark:text-violet-300"
                  : "text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-700 dark:text-sky-300"
              }
            >
              {prompt.kind}
            </span>
            {isActiveCleanup && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                active
              </span>
            )}
          </div>
          <p className="text-xs text-muted">updated {relTime(prompt.updatedAt)}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => setEditing(true)}
            className="text-xs px-2 py-1 rounded bg-surface-2 hover:bg-surface-3"
          >
            edit
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete prompt "${prompt.name}"? Past generations are kept.`)) del.mutate();
            }}
            className="text-xs px-2 py-1 rounded bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/40 dark:hover:bg-rose-900/60 dark:text-rose-200"
          >
            delete
          </button>
        </div>
      </div>
      {prompt.previousBody && (
        <div className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded bg-amber-500/10 text-amber-800 dark:text-amber-200">
          <span>Last change can be undone.</span>
          <button
            onClick={() => undo.mutate()}
            disabled={undo.isPending}
            className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-50"
          >
            {undo.isPending ? "undoing…" : "undo"}
          </button>
        </div>
      )}
      <pre className="text-sm text-fg-soft whitespace-pre-wrap font-mono">{prompt.body}</pre>
    </div>
  );
}
