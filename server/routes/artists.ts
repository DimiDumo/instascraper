import { Hono } from "hono";
import { listArtists, getArtistDetail } from "../../src/db";

export const artistsRoute = new Hono();

artistsRoute.get("/", (c) => {
  const url = new URL(c.req.url);
  const limit = Math.min(200, Number(url.searchParams.get("limit") ?? 60));
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const search = url.searchParams.get("search") ?? undefined;
  const minFollowers = url.searchParams.get("minFollowers");
  const maxFollowers = url.searchParams.get("maxFollowers");
  const result = listArtists({
    limit,
    offset,
    search,
    minFollowers: minFollowers ? Number(minFollowers) : undefined,
    maxFollowers: maxFollowers ? Number(maxFollowers) : undefined,
  });
  return c.json(result);
});

artistsRoute.get("/:username", (c) => {
  const username = c.req.param("username");
  const artist = getArtistDetail(username);
  if (!artist) return c.json({ error: "not found" }, 404);
  return c.json(artist);
});
