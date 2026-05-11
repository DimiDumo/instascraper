import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, imageUrl, relTime } from "../lib/api";
import { ImageGrid } from "../components/ImageGrid";
import { GenerationCard } from "../components/GenerationCard";

export function ArtistDetail() {
  const { username = "" } = useParams();
  const qc = useQueryClient();
  const { data: artist, isLoading } = useQuery({
    queryKey: ["artists", username],
    queryFn: () => api.getArtist(username),
    enabled: Boolean(username),
  });

  const { data: prompts } = useQuery({
    queryKey: ["prompts"],
    queryFn: api.listPrompts,
  });

  const { data: generations } = useQuery({
    queryKey: ["generations", username],
    queryFn: () => api.listGenerations(username),
    enabled: Boolean(username),
    refetchInterval: (q) => {
      const rows = q.state.data?.rows ?? [];
      return rows.some((g) => g.status === "running") ? 3000 : false;
    },
  });

  const [selectedPromptId, setSelectedPromptId] = useState<number | null>(null);
  const promptOptions = (prompts?.rows ?? []).filter((p) => p.kind === "generate");
  const cleanupPrompt = (prompts?.rows ?? []).find((p) => p.kind === "cleanup") ?? null;
  const activePromptId =
    selectedPromptId ?? (promptOptions.length > 0 ? promptOptions[0].id : null);

  const rescrape = useMutation({
    mutationFn: () => api.scrapeArtist(username),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });

  const generate = useMutation({
    mutationFn: () => {
      if (!activePromptId) throw new Error("no prompt selected");
      return api.generate(username, activePromptId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["generations", username] }),
  });

  if (isLoading) return <p className="text-muted">Loading…</p>;
  if (!artist) return <p className="text-muted">Artist not found.</p>;

  const pic = imageUrl(artist.profilePicLocalPath) ?? artist.profilePicUrl ?? undefined;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-sm text-muted hover:text-fg">← back</Link>
      </div>
      <div className="flex items-start gap-4">
        <div className="w-24 h-24 rounded-full bg-surface-2 overflow-hidden flex-shrink-0">
          {pic ? <img src={pic} alt={artist.username} className="w-full h-full object-cover" /> : null}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">@{artist.username}</h1>
          {artist.fullName && <p className="text-fg">{artist.fullName}</p>}
          {artist.bio && <p className="mt-2 text-sm text-fg-soft max-w-2xl whitespace-pre-line">{artist.bio}</p>}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
            <span><strong className="text-fg">{(artist.followersCount ?? 0).toLocaleString()}</strong> followers</span>
            <span><strong className="text-fg">{(artist.postsCount ?? artist.posts.length).toLocaleString()}</strong> posts</span>
            <span>last scraped {relTime(artist.scrapedAt)}</span>
          </div>
          <div className="mt-4 flex gap-2">
            <a
              href={`https://instagram.com/${artist.username}/`}
              target="_blank"
              rel="noreferrer"
              className="text-xs px-3 py-1.5 rounded bg-surface-2 hover:bg-surface-3"
            >
              open on Instagram
            </a>
            <button
              onClick={() => rescrape.mutate()}
              disabled={rescrape.isPending}
              className="text-xs px-3 py-1.5 rounded bg-accent/80 text-black hover:bg-accent disabled:opacity-50"
            >
              {rescrape.isPending ? "queued…" : "rescrape"}
            </button>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-medium">Generate</h2>
          <Link to="/prompts" className="text-xs text-muted hover:text-fg">
            manage prompts →
          </Link>
        </div>
        {promptOptions.length === 0 ? (
          <p className="text-sm text-muted">
            {(prompts?.rows ?? []).length === 0
              ? <>No prompts yet. <Link to="/prompts" className="text-accent hover:underline">Create one</Link> to generate a DM.</>
              : <>No <em>generate</em> prompts yet — only cleanup. <Link to="/prompts" className="text-accent hover:underline">Create a generate prompt</Link>.</>}
          </p>
        ) : (
          <div className="flex gap-2 items-center flex-wrap">
            <select
              value={activePromptId ?? ""}
              onChange={(e) => setSelectedPromptId(Number(e.target.value))}
              className="bg-panel border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-muted"
            >
              {promptOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => generate.mutate()}
              disabled={!activePromptId || generate.isPending}
              className="text-sm px-4 py-1.5 rounded bg-accent text-black font-medium hover:bg-accent/90 disabled:opacity-40"
            >
              {generate.isPending ? "queueing…" : "Generate"}
            </button>
            <span className="text-xs text-muted">
              {cleanupPrompt
                ? `→ auto-cleanup: ${cleanupPrompt.name}`
                : "no cleanup prompt — output stays raw"}
            </span>
          </div>
        )}
        {(generations?.rows.length ?? 0) > 0 && (
          <div className="space-y-3 mt-3">
            {generations!.rows.map((g) => (
              <GenerationCard key={g.id} generation={g} username={username} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Posts ({artist.posts.length})</h2>
        <ImageGrid posts={artist.posts} />
      </section>
    </div>
  );
}
