import { createMiddleware } from "hono/factory";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AppBindings } from "../types";

// Cache JWKS per team domain across requests within an isolate.
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(teamDomain: string) {
  let jwks = jwksCache.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
    jwksCache.set(teamDomain, jwks);
  }
  return jwks;
}

/**
 * Verifies the Cf-Access-Jwt-Assertion header set by Cloudflare Access
 * for any request that passed the Access policy (browser OR service-token).
 *
 * CF Access already blocks unauthenticated requests at the edge. This middleware
 * is defense-in-depth: someone with the Worker's direct workers.dev URL who
 * bypasses the Access front would have no valid JWT and get 401.
 */
export const accessAuth = createMiddleware<AppBindings>(async (c, next) => {
  const token =
    c.req.header("Cf-Access-Jwt-Assertion") ?? c.req.header("cf-access-jwt-assertion");
  const team = c.env.CF_ACCESS_TEAM_DOMAIN;
  const aud = c.env.CF_ACCESS_AUD;

  if (!team || team === "REPLACE_ME" || !aud) {
    // Not yet configured — fail closed so we don't ship an open Worker by accident.
    return c.json({ error: "CF Access not configured on Worker" }, 503);
  }
  if (!token) {
    return c.json({ error: "missing Cf-Access-Jwt-Assertion" }, 401);
  }

  try {
    const { payload } = await jwtVerify(token, getJwks(team), {
      issuer: `https://${team}`,
      audience: aud,
    });
    const email = (payload.email as string | undefined) ?? null;
    // Service tokens have a `common_name` and no email; browser logins have email.
    c.set("accessEmail", email);
    c.set("accessIdentity", email ? "user" : payload.common_name ? "service" : "unknown");
    await next();
  } catch (err) {
    return c.json({ error: "invalid Access JWT", detail: (err as Error).message }, 401);
  }
});
