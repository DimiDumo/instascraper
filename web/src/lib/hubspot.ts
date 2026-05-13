const PORTAL_ID = "25480349";
const APP_HOST = "app-eu1.hubspot.com";

export function hubspotContactUrl(contactId: string | null | undefined): string | null {
  if (!contactId) return null;
  return `https://${APP_HOST}/contacts/${PORTAL_ID}/record/0-1/${encodeURIComponent(contactId)}`;
}
