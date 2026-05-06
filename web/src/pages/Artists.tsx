import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { ArtistCard } from "../components/ArtistCard";

export function Artists() {
  const [search, setSearch] = useState("");
  const [minFollowersInput, setMinFollowersInput] = useState("");
  const [maxFollowersInput, setMaxFollowersInput] = useState("");

  const minFollowers =
    minFollowersInput.trim() === "" ? undefined : Number(minFollowersInput);
  const maxFollowers =
    maxFollowersInput.trim() === "" ? undefined : Number(maxFollowersInput);
  const validMin = typeof minFollowers === "number" && Number.isFinite(minFollowers) ? minFollowers : undefined;
  const validMax = typeof maxFollowers === "number" && Number.isFinite(maxFollowers) ? maxFollowers : undefined;

  const { data, isLoading } = useQuery({
    queryKey: ["artists", search, validMin, validMax],
    queryFn: () =>
      api.listArtists({
        search: search || undefined,
        minFollowers: validMin,
        maxFollowers: validMax,
        limit: 120,
      }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Artists</h1>
          <p className="text-sm text-muted">{data?.total ?? 0} discovered</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={0}
            value={minFollowersInput}
            onChange={(e) => setMinFollowersInput(e.target.value)}
            placeholder="min followers"
            className="bg-panel border border-border rounded px-3 py-1.5 text-sm w-36 focus:outline-none focus:border-muted"
          />
          <input
            type="number"
            min={0}
            value={maxFollowersInput}
            onChange={(e) => setMaxFollowersInput(e.target.value)}
            placeholder="max followers"
            className="bg-panel border border-border rounded px-3 py-1.5 text-sm w-36 focus:outline-none focus:border-muted"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="search username or name"
            className="bg-panel border border-border rounded px-3 py-1.5 text-sm w-64 focus:outline-none focus:border-muted"
          />
        </div>
      </div>
      {isLoading ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {data?.rows.map((a) => (
            <ArtistCard key={a.id} artist={a} />
          ))}
        </div>
      )}
    </div>
  );
}
