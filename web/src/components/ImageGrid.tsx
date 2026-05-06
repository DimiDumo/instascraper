import type { Post } from "../lib/api";
import { imageUrl } from "../lib/api";

export function ImageGrid({ posts }: { posts: Post[] }) {
  if (posts.length === 0) {
    return <p className="text-muted text-sm">No posts scraped yet.</p>;
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
      {posts.map((post) => {
        const src =
          imageUrl(post.imageLocalPath) ??
          imageUrl(post.images[0]?.localPath) ??
          post.images[0]?.url ??
          undefined;
        return (
          <a
            key={post.id}
            href={`https://instagram.com/p/${post.shortcode}/`}
            target="_blank"
            rel="noreferrer"
            className="group relative aspect-square block bg-panel rounded overflow-hidden border border-border hover:border-muted"
            title={post.caption ?? post.shortcode}
          >
            {src ? (
              <img
                src={src}
                alt={post.shortcode}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted text-xs">
                no image
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent text-[10px] text-zinc-200 p-1.5 opacity-0 group-hover:opacity-100">
              ♥ {(post.likesCount ?? 0).toLocaleString()} · 💬 {(post.commentsCount ?? 0).toLocaleString()}
            </div>
          </a>
        );
      })}
    </div>
  );
}
