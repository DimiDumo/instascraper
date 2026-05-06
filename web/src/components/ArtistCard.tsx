import { Link } from "react-router-dom";
import type { Artist } from "../lib/api";
import { imageUrl, relTime } from "../lib/api";

export function ArtistCard({ artist }: { artist: Artist }) {
  const pic = imageUrl(artist.profilePicLocalPath) ?? artist.profilePicUrl ?? undefined;
  return (
    <Link
      to={`/artists/${artist.username}`}
      className="block bg-panel border border-border rounded-lg p-3 hover:border-muted transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-surface-2 overflow-hidden flex-shrink-0">
          {pic ? (
            <img src={pic} alt={artist.username} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted text-lg">
              {artist.username[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate">@{artist.username}</div>
          {artist.fullName && (
            <div className="text-xs text-muted truncate">{artist.fullName}</div>
          )}
        </div>
      </div>
      {artist.bio && (
        <p className="mt-2 text-xs text-fg-soft line-clamp-2">{artist.bio}</p>
      )}
      <div className="mt-2 flex items-center justify-between text-xs text-muted">
        <span>{(artist.followersCount ?? 0).toLocaleString()} followers</span>
        <span>{relTime(artist.scrapedAt)}</span>
      </div>
    </Link>
  );
}
