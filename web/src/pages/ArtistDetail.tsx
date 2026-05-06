import { useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, imageUrl, relTime } from "../lib/api";
import { ImageGrid } from "../components/ImageGrid";

export function ArtistDetail() {
  const { username = "" } = useParams();
  const qc = useQueryClient();
  const { data: artist, isLoading } = useQuery({
    queryKey: ["artists", username],
    queryFn: () => api.getArtist(username),
    enabled: Boolean(username),
  });

  const rescrape = useMutation({
    mutationFn: () => api.scrapeArtist(username),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
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

      <section>
        <h2 className="text-lg font-medium mb-3">Posts ({artist.posts.length})</h2>
        <ImageGrid posts={artist.posts} />
      </section>
    </div>
  );
}
