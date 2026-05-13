import { Hono } from "hono";
import type { AppBindings } from "../types";
import { makeDb } from "../db/client";
import {
  getArtistByUsername,
  getArtistById,
  getLatestDoneGeneration,
  setArtistHubspotSync,
  getGenerationWithArtist,
  markGenerationReady,
  markGenerationSent,
} from "../db/queries";
import {
  searchContactByHandle,
  createContact,
  updateContact,
  ensureCustomProperty,
  setLeadStatusAttempted,
  createInstagramDmNote,
  CUSTOM_PROPERTIES,
  HubSpotError,
  type ContactProps,
} from "../hubspot/client";

export const hubspotRoute = new Hono<AppBindings>();

function requireKey(env: { HUBSPOT_SERVICE_KEY?: string }): string | null {
  return env.HUBSPOT_SERVICE_KEY && env.HUBSPOT_SERVICE_KEY.length > 0
    ? env.HUBSPOT_SERVICE_KEY
    : null;
}

function splitName(fullName: string | null): { firstname?: string; lastname?: string } {
  if (!fullName) return {};
  const trimmed = fullName.trim();
  if (!trimmed) return {};
  const idx = trimmed.indexOf(" ");
  if (idx < 0) return { firstname: trimmed };
  return { firstname: trimmed.slice(0, idx), lastname: trimmed.slice(idx + 1).trim() || undefined };
}

hubspotRoute.post("/init-properties", async (c) => {
  if (!requireKey(c.env)) return c.json({ error: "HUBSPOT_SERVICE_KEY not configured" }, 503);
  const results: Array<{ name: string; status: "exists" | "created" }> = [];
  try {
    for (const def of CUSTOM_PROPERTIES) {
      const status = await ensureCustomProperty(c.env, def);
      results.push({ name: def.name, status });
    }
  } catch (e) {
    if (e instanceof HubSpotError) return c.json({ error: e.message, results }, 502);
    throw e;
  }
  return c.json({ ok: true, results });
});

hubspotRoute.post("/sync/:username", async (c) => {
  if (!requireKey(c.env)) return c.json({ error: "HUBSPOT_SERVICE_KEY not configured" }, 503);
  const username = c.req.param("username");
  const db = makeDb(c.env.DB);

  const artist = await getArtistByUsername(db, username);
  if (!artist) return c.json({ error: "artist not found" }, 404);

  const latestGen = await getLatestDoneGeneration(db, artist.id);

  const { firstname, lastname } = splitName(artist.fullName);
  const props: ContactProps = {
    instagram_handle: artist.username,
    firstname,
    lastname,
    instagram_bio: artist.bio,
    instagram_followers_count:
      typeof artist.followersCount === "number" ? artist.followersCount : undefined,
    generated_insta_dm: latestGen?.output ?? undefined,
  };

  try {
    let contactId = artist.hubspotContactId;
    if (!contactId) {
      const hit = await searchContactByHandle(c.env, artist.username);
      contactId = hit?.id ?? null;
    }

    if (contactId) {
      await updateContact(c.env, contactId, props);
    } else {
      // Stamp lead_source on first create only — re-syncs preserve any manual
      // edits the outreach team makes in HubSpot.
      const created = await createContact(c.env, { ...props, lead_source: "REO" });
      contactId = created.id;
    }

    const syncedAt = await setArtistHubspotSync(db, artist.id, contactId);
    return c.json({
      hubspotContactId: contactId,
      hubspotSyncedAt: syncedAt.toISOString(),
      hasDm: Boolean(latestGen?.output),
    });
  } catch (e) {
    if (e instanceof HubSpotError) return c.json({ error: e.message }, 502);
    throw e;
  }
});

hubspotRoute.post("/generations/:id/ready", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "invalid id" }, 400);
  const db = makeDb(c.env.DB);
  const gen = await getGenerationWithArtist(db, id);
  if (!gen) return c.json({ error: "generation not found" }, 404);
  if (gen.status !== "done") return c.json({ error: "generation not done" }, 409);
  if (gen.readyToSendAt) {
    return c.json({ ...gen, readyToSendAt: gen.readyToSendAt });
  }
  const readyAt = await markGenerationReady(db, id);
  return c.json({ ...gen, readyToSendAt: readyAt.toISOString() });
});

hubspotRoute.post("/generations/:id/sent", async (c) => {
  if (!requireKey(c.env)) return c.json({ error: "HUBSPOT_SERVICE_KEY not configured" }, 503);
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "invalid id" }, 400);
  const db = makeDb(c.env.DB);
  const gen = await getGenerationWithArtist(db, id);
  if (!gen) return c.json({ error: "generation not found" }, 404);
  if (gen.status !== "done") return c.json({ error: "generation not done" }, 409);
  if (!gen.readyToSendAt) return c.json({ error: "mark ready before sending" }, 409);
  const artist = gen.artist ?? (await getArtistById(db, gen.artistId));
  if (!artist?.hubspotContactId) return c.json({ error: "sync artist to HubSpot first" }, 409);

  // sentAt is idempotent: keep the first stamp on retries so HubSpot timeline
  // matches the actual send time the team recorded.
  const sentAt = gen.sentAt ?? (await markGenerationSent(db, id));

  try {
    const statusChange = await setLeadStatusAttempted(c.env, artist.hubspotContactId);
    const note = await createInstagramDmNote(c.env, {
      contactId: artist.hubspotContactId,
      body: gen.output,
      sentAt: sentAt instanceof Date ? sentAt : new Date(sentAt),
    });
    return c.json({
      generationId: id,
      sentAt: (sentAt instanceof Date ? sentAt : new Date(sentAt)).toISOString(),
      leadStatus: statusChange,
      noteId: note.id,
    });
  } catch (e) {
    if (e instanceof HubSpotError) return c.json({ error: e.message }, 502);
    throw e;
  }
});
