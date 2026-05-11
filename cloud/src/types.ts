export interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
  CF_ACCESS_TEAM_DOMAIN: string;
  CF_ACCESS_AUD: string;
}

export type AppBindings = {
  Bindings: Env;
  Variables: {
    accessEmail: string | null;
    accessIdentity: "user" | "service" | "unknown";
  };
};
