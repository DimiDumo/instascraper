import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, relTime, type Generation } from "../lib/api";

export function GenerationCard({
  generation,
  username,
  hubspotContactId,
}: {
  generation: Generation;
  username: string;
  hubspotContactId: string | null;
}) {
  const qc = useQueryClient();
  const [output, setOutput] = useState(generation.output);
  const [copied, setCopied] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const [refineOpen, setRefineOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [proposedBody, setProposedBody] = useState<string | null>(null);
  const [refineError, setRefineError] = useState<string | null>(null);
  const [previewOutput, setPreviewOutput] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Keep textarea in sync if upstream value changes (e.g. polling fills in result)
  useEffect(() => {
    setOutput(generation.output);
  }, [generation.id, generation.output]);

  const save = useMutation({
    mutationFn: () => api.updateGeneration(generation.id, output),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["generations", username] }),
  });

  const del = useMutation({
    mutationFn: () => api.deleteGeneration(generation.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["generations", username] }),
  });

  const preview = useMutation({
    mutationFn: (body: string) => {
      if (!body.trim()) throw new Error("nothing to preview");
      return api.previewGeneration(username, body);
    },
    onSuccess: (res) => {
      setPreviewOutput(res.output);
      setPreviewError(null);
    },
    onError: (err: unknown) => {
      setPreviewError(err instanceof Error ? err.message : String(err));
      setPreviewOutput(null);
    },
  });

  const refine = useMutation({
    mutationFn: () => {
      if (!generation.promptId) throw new Error("prompt was deleted; can't refine");
      return api.refinePrompt(generation.promptId, generation.id, feedback.trim());
    },
    onSuccess: (res) => {
      setProposedBody(res.proposedBody);
      setRefineError(null);
      setPreviewOutput(null);
      setPreviewError(null);
      preview.mutate(res.proposedBody);
    },
    onError: (err: unknown) => {
      setRefineError(err instanceof Error ? err.message : String(err));
      setProposedBody(null);
    },
  });

  const apply = useMutation({
    mutationFn: () => {
      if (!generation.promptId || proposedBody == null) throw new Error("nothing to apply");
      return api.updatePrompt(generation.promptId, { body: proposedBody });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prompts"] });
      setRefineOpen(false);
      setFeedback("");
      setProposedBody(null);
      setRefineError(null);
    },
  });

  const markReady = useMutation({
    mutationFn: () => api.markGenerationReady(generation.id),
    onMutate: () => setSendError(null),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["generations", username] }),
    onError: (err: unknown) => setSendError(err instanceof Error ? err.message : String(err)),
  });

  const markSent = useMutation({
    mutationFn: () => api.markGenerationSent(generation.id),
    onMutate: () => setSendError(null),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["generations", username] }),
    onError: (err: unknown) => setSendError(err instanceof Error ? err.message : String(err)),
  });

  const closeRefine = () => {
    setRefineOpen(false);
    setFeedback("");
    setProposedBody(null);
    setRefineError(null);
    setPreviewOutput(null);
    setPreviewError(null);
  };

  const dirty = output !== generation.output;
  const statusBadge = (() => {
    if (generation.status === "running")
      return <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300">running</span>;
    if (generation.status === "failed")
      return <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-700 dark:text-rose-300">failed</span>;
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">done</span>;
  })();

  return (
    <div className="border border-border rounded p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{generation.promptName ?? "(prompt deleted)"}</span>
          {statusBadge}
          <span className="text-xs text-muted">{relTime(generation.createdAt)}</span>
        </div>
        <div className="flex gap-2">
          {generation.status === "done" && (
            <>
              <a
                href={`https://instagram.com/${username}/`}
                target="_blank"
                rel="noreferrer"
                className="text-xs px-2 py-1 rounded bg-surface-2 hover:bg-surface-3"
              >
                open IG
              </a>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(output);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="text-xs px-2 py-1 rounded bg-surface-2 hover:bg-surface-3"
              >
                {copied ? "copied" : "copy"}
              </button>
            </>
          )}
          <button
            onClick={() => {
              if (confirm("Delete this generation?")) del.mutate();
            }}
            className="text-xs px-2 py-1 rounded bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/40 dark:hover:bg-rose-900/60 dark:text-rose-200"
          >
            delete
          </button>
        </div>
      </div>

      {generation.status === "running" && (
        <p className="text-sm text-muted">Claude is working… (≤60s typical)</p>
      )}

      {generation.status === "failed" && (
        <pre className="text-xs text-rose-600 dark:text-rose-300 whitespace-pre-wrap font-mono">
          {generation.errorMessage ?? "Generation failed."}
        </pre>
      )}

      {generation.status === "done" && (
        <>
          <textarea
            value={output}
            onChange={(e) => setOutput(e.target.value)}
            rows={Math.max(3, Math.min(12, output.split("\n").length + 1))}
            className="bg-panel border border-border rounded px-3 py-2 text-sm w-full focus:outline-none focus:border-muted"
          />
          <div className="flex justify-end gap-2 flex-wrap">
            {!refineOpen && generation.promptId && (
              <button
                onClick={() => setRefineOpen(true)}
                className="text-xs px-3 py-1.5 rounded bg-surface-2 hover:bg-surface-3"
              >
                refine prompt
              </button>
            )}
            {dirty && (
              <button
                onClick={() => setOutput(generation.output)}
                className="text-xs px-3 py-1.5 rounded bg-surface-2 hover:bg-surface-3"
              >
                revert
              </button>
            )}
            <button
              onClick={() => save.mutate()}
              disabled={!dirty || save.isPending}
              className="text-xs px-3 py-1.5 rounded bg-accent/80 text-black hover:bg-accent disabled:opacity-40"
            >
              {save.isPending ? "saving…" : dirty ? "save" : "saved"}
            </button>
            {!generation.readyToSendAt ? (
              <button
                onClick={() => markReady.mutate()}
                disabled={markReady.isPending || dirty}
                title={dirty ? "save edits first" : undefined}
                className="text-xs px-3 py-1.5 rounded bg-surface-2 hover:bg-surface-3 disabled:opacity-40"
              >
                {markReady.isPending ? "marking…" : "mark ready"}
              </button>
            ) : (
              <span className="text-xs px-3 py-1.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                ready · {relTime(generation.readyToSendAt)}
              </span>
            )}
            {generation.readyToSendAt && !generation.sentAt && (
              <button
                onClick={() => markSent.mutate()}
                disabled={markSent.isPending || !hubspotContactId}
                title={!hubspotContactId ? "sync artist to HubSpot first" : undefined}
                className="text-xs px-3 py-1.5 rounded bg-accent text-black font-medium hover:bg-accent/90 disabled:opacity-40"
              >
                {markSent.isPending ? "sending…" : "mark sent"}
              </button>
            )}
            {generation.sentAt && (
              <span className="text-xs px-3 py-1.5 rounded bg-violet-500/15 text-violet-700 dark:text-violet-300">
                sent · {relTime(generation.sentAt)}
              </span>
            )}
          </div>
          {sendError && (
            <p className="text-xs text-rose-600 dark:text-rose-300 text-right">{sendError}</p>
          )}

          {refineOpen && (
            <div className="border border-dashed border-border rounded p-3 mt-2 space-y-3 bg-panel/40">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Refine prompt based on this output</h4>
                <button
                  onClick={closeRefine}
                  className="text-xs text-muted hover:text-fg"
                >
                  close
                </button>
              </div>
              <p className="text-xs text-muted">
                Tell Claude what's off about the DM above. It rewrites the underlying prompt template (general,
                not artist-specific) so future generations behave differently.
              </p>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="e.g. zu generisch, soll konkret auf Farbe/Motiv eingehen — und kürzer, max 2 Sätze"
                rows={3}
                className="bg-panel border border-border rounded px-3 py-2 text-sm w-full focus:outline-none focus:border-muted"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => refine.mutate()}
                  disabled={!feedback.trim() || refine.isPending}
                  className="text-xs px-3 py-1.5 rounded bg-accent/80 text-black hover:bg-accent disabled:opacity-40"
                >
                  {refine.isPending ? "thinking… (≤60s)" : "propose new prompt"}
                </button>
              </div>

              {refineError && (
                <pre className="text-xs text-rose-600 dark:text-rose-300 whitespace-pre-wrap font-mono">{refineError}</pre>
              )}

              {proposedBody !== null && (
                <div className="space-y-2">
                  <label className="text-xs uppercase text-muted block">Proposed prompt (editable)</label>
                  <textarea
                    value={proposedBody}
                    onChange={(e) => {
                      setProposedBody(e.target.value);
                      setPreviewOutput(null);
                      setPreviewError(null);
                    }}
                    rows={Math.max(6, Math.min(16, proposedBody.split("\n").length + 1))}
                    className="bg-panel border border-border rounded px-3 py-2 text-sm w-full font-mono focus:outline-none focus:border-muted"
                  />
                  {preview.isPending && (
                    <p className="text-xs text-muted">Generating preview DM with new prompt… (≤60s)</p>
                  )}

                  {!preview.isPending && previewOutput === null && (
                    <div className="flex justify-end gap-2 flex-wrap">
                      <button
                        onClick={() => preview.mutate(proposedBody)}
                        disabled={!proposedBody.trim()}
                        className="text-xs px-3 py-1.5 rounded bg-surface-2 hover:bg-surface-3 disabled:opacity-40"
                      >
                        regenerate preview
                      </button>
                    </div>
                  )}

                  {previewError && (
                    <pre className="text-xs text-rose-600 dark:text-rose-300 whitespace-pre-wrap font-mono">{previewError}</pre>
                  )}

                  {previewOutput !== null && (
                    <div className="space-y-2">
                      <label className="text-xs uppercase text-muted block">
                        Preview DM (new prompt run against @{username})
                      </label>
                      <textarea
                        value={previewOutput}
                        onChange={(e) => setPreviewOutput(e.target.value)}
                        rows={Math.max(3, Math.min(12, previewOutput.split("\n").length + 1))}
                        className="bg-panel border border-border rounded px-3 py-2 text-sm w-full focus:outline-none focus:border-muted"
                      />
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={closeRefine}
                      className="text-xs px-3 py-1.5 rounded bg-surface-2 hover:bg-surface-3"
                    >
                      discard
                    </button>
                    <button
                      onClick={() => apply.mutate()}
                      disabled={apply.isPending || !proposedBody.trim()}
                      className="text-xs px-3 py-1.5 rounded bg-accent text-black font-medium hover:bg-accent/90 disabled:opacity-40"
                    >
                      {apply.isPending ? "applying…" : "apply (overwrite prompt)"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
