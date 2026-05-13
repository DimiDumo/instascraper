import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type DmStatus } from "../lib/api";
import { ArtistCard } from "../components/ArtistCard";
import { DM_STATUSES, DM_STATUS_BADGE, DM_STATUS_LABEL } from "../lib/dmStatus";

export function Artists() {
  const [search, setSearch] = useState("");
  const [minFollowersInput, setMinFollowersInput] = useState("");
  const [maxFollowersInput, setMaxFollowersInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<Set<DmStatus>>(new Set());

  const minFollowers = minFollowersInput.trim() === "" ? undefined : Number(minFollowersInput);
  const maxFollowers =
    maxFollowersInput.trim() === "" ? undefined : Number(maxFollowersInput);
  const validMin = typeof minFollowers === "number" && Number.isFinite(minFollowers) ? minFollowers : undefined;
  const validMax = typeof maxFollowers === "number" && Number.isFinite(maxFollowers) ? maxFollowers : undefined;
  const dmStatuses = Array.from(statusFilter).sort();

  const { data, isLoading } = useQuery({
    queryKey: ["artists", search, validMin, validMax, dmStatuses.join(",")],
    queryFn: () =>
      api.listArtists({
        search: search || undefined,
        minFollowers: validMin,
        maxFollowers: validMax,
        dmStatuses: dmStatuses.length > 0 ? dmStatuses : undefined,
        limit: 120,
      }),
  });

  const toggleStatus = (s: DmStatus) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

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
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted mr-1">DM status:</span>
        {DM_STATUSES.map((s) => {
          const active = statusFilter.has(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggleStatus(s)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                active
                  ? `${DM_STATUS_BADGE[s]} border-transparent`
                  : "bg-panel border-border text-muted hover:text-fg hover:border-muted"
              }`}
            >
              {DM_STATUS_LABEL[s]}
            </button>
          );
        })}
        {statusFilter.size > 0 && (
          <button
            type="button"
            onClick={() => setStatusFilter(new Set())}
            className="text-xs text-muted hover:text-fg ml-1"
          >
            clear
          </button>
        )}
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
