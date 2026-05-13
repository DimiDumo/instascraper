import * as cloud from "../cloud/client";

export async function handleInitProperties() {
  try {
    const res = await cloud.hubspot.initProperties();
    for (const r of res.results) {
      console.log(`${r.name}: ${r.status}`);
    }
    console.log(JSON.stringify({ success: true, ...res }));
  } catch (error) {
    console.error("Failed to init HubSpot properties:", error);
    process.exit(1);
  }
}

export async function handleSync(username: string) {
  try {
    const res = await cloud.hubspot.sync(username);
    console.log(
      `Synced @${username} → HubSpot contact ${res.hubspotContactId} (DM ${res.hasDm ? "included" : "missing"})`,
    );
    console.log(JSON.stringify({ success: true, ...res }));
  } catch (error) {
    console.error(`Failed to sync @${username}:`, error);
    process.exit(1);
  }
}
