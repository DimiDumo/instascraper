// HubSpot REST helpers for the Worker. Auth is a Bearer private-app token
// stored as the HUBSPOT_SERVICE_KEY Worker secret.

const BASE = "https://api.hubapi.com";

export interface HubSpotEnv {
  HUBSPOT_SERVICE_KEY: string;
}

export class HubSpotError extends Error {
  constructor(public status: number, public body: string) {
    super(`HubSpot ${status}: ${body.slice(0, 300)}`);
  }
}

async function hsFetch(env: HubSpotEnv, path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.HUBSPOT_SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  return res;
}

async function hsJson<T>(env: HubSpotEnv, path: string, init: RequestInit = {}): Promise<T> {
  const res = await hsFetch(env, path, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new HubSpotError(res.status, text);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface ContactSearchHit {
  id: string;
  properties: Record<string, string | null>;
}

export async function searchContactByHandle(
  env: HubSpotEnv,
  handle: string,
): Promise<ContactSearchHit | null> {
  const body = {
    filterGroups: [
      {
        filters: [
          { propertyName: "instagram_handle", operator: "EQ", value: handle },
        ],
      },
    ],
    properties: ["instagram_handle", "firstname", "lastname"],
    limit: 1,
  };
  const data = await hsJson<{ results: ContactSearchHit[] }>(
    env,
    "/crm/v3/objects/contacts/search",
    { method: "POST", body: JSON.stringify(body) },
  );
  return data.results?.[0] ?? null;
}

export type ContactProps = Record<string, string | number | null | undefined>;

function cleanProps(props: ContactProps): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined) continue;
    out[k] = String(v);
  }
  return out;
}

export async function createContact(env: HubSpotEnv, props: ContactProps): Promise<{ id: string }> {
  const data = await hsJson<{ id: string }>(env, "/crm/v3/objects/contacts", {
    method: "POST",
    body: JSON.stringify({ properties: cleanProps(props) }),
  });
  return { id: data.id };
}

export async function updateContact(
  env: HubSpotEnv,
  id: string,
  props: ContactProps,
): Promise<void> {
  await hsJson<unknown>(env, `/crm/v3/objects/contacts/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ properties: cleanProps(props) }),
  });
}

export interface CustomPropertyDef {
  name: string;
  label: string;
  type: "string" | "number";
  fieldType: "text" | "textarea" | "number";
  description?: string;
  groupName?: string;
}

export async function ensureCustomProperty(
  env: HubSpotEnv,
  def: CustomPropertyDef,
): Promise<"exists" | "created"> {
  const probe = await hsFetch(env, `/crm/v3/properties/contacts/${def.name}`, { method: "GET" });
  if (probe.ok) return "exists";
  if (probe.status !== 404) {
    const text = await probe.text().catch(() => "");
    throw new HubSpotError(probe.status, text);
  }
  await hsJson<unknown>(env, "/crm/v3/properties/contacts", {
    method: "POST",
    body: JSON.stringify({
      name: def.name,
      label: def.label,
      type: def.type,
      fieldType: def.fieldType,
      groupName: def.groupName ?? "contactinformation",
      description: def.description ?? "",
    }),
  });
  return "created";
}

// Lead status values that already represent contact-or-later — don't downgrade.
const TERMINAL_LEAD_STATUSES = new Set([
  "ATTEMPTED_TO_CONTACT",
  "CONNECTED",
  "OPEN_DEAL",
  "UNQUALIFIED",
  "BAD_TIMING",
]);

export async function getContactLeadStatus(env: HubSpotEnv, contactId: string): Promise<string | null> {
  const data = await hsJson<{ properties: Record<string, string | null> }>(
    env,
    `/crm/v3/objects/contacts/${contactId}?properties=hs_lead_status`,
    { method: "GET" },
  );
  return data.properties?.hs_lead_status ?? null;
}

export async function setLeadStatusAttempted(
  env: HubSpotEnv,
  contactId: string,
): Promise<"skipped" | "updated"> {
  const current = await getContactLeadStatus(env, contactId);
  if (current && TERMINAL_LEAD_STATUSES.has(current)) return "skipped";
  await updateContact(env, contactId, { hs_lead_status: "ATTEMPTED_TO_CONTACT" });
  return "updated";
}

export async function createInstagramDmNote(
  env: HubSpotEnv,
  opts: { contactId: string; body: string; sentAt: Date },
): Promise<{ id: string }> {
  // HubSpot's Communications object channel-type enum can't be extended (its
  // definition is read-only and the existing options — SMS, WhatsApp, LinkedIn,
  // Physical Mail — don't fit Instagram). Use a Note instead: always shows on
  // the contact timeline, no channel field needed.
  const noteBody = `[Instagram DM sent]\n\n${opts.body}`;
  const created = await hsJson<{ id: string }>(env, "/crm/v3/objects/notes", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        hs_note_body: noteBody,
        hs_timestamp: opts.sentAt.toISOString(),
      },
    }),
  });
  // Default association: Note → Contact.
  await hsJson<unknown>(
    env,
    `/crm/v4/objects/notes/${created.id}/associations/default/contacts/${opts.contactId}`,
    { method: "PUT" },
  );
  return created;
}

export const CUSTOM_PROPERTIES: CustomPropertyDef[] = [
  {
    name: "instagram_bio",
    label: "Instagram Bio",
    type: "string",
    fieldType: "textarea",
    description: "Bio scraped from the contact's Instagram profile",
  },
  {
    name: "instagram_followers_count",
    label: "Instagram Followers",
    type: "number",
    fieldType: "number",
    description: "Follower count snapshot from Instagram",
  },
  {
    name: "generated_insta_dm",
    label: "Generated Instagram DM",
    type: "string",
    fieldType: "textarea",
    description: "AI-generated outreach DM to send via Instagram",
  },
];
