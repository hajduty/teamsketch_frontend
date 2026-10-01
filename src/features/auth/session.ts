// Session helpers: read the token's expiry, and tell the app when the session is over.

// Treat a token as expired slightly early, so a request doesn't leave with seconds to spare
const EXPIRY_MARGIN_MS = 5_000;

/** Expiry of a JWT in ms since epoch, or null when it isn't a JWT or has no `exp`. */
export const tokenExpiry = (token: string | null | undefined): number | null => {
  const payload = token?.split(".")[1];
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "="));
    const exp = JSON.parse(json).exp;
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
};

export const isTokenExpired = (token: string | null | undefined, now = Date.now()) => {
  const expiry = tokenExpiry(token);
  return expiry !== null && now >= expiry - EXPIRY_MARGIN_MS;
};

/** Ms until the token counts as expired (never negative), or null if it doesn't expire. */
export const msUntilExpiry = (token: string | null | undefined, now = Date.now()) => {
  const expiry = tokenExpiry(token);
  return expiry === null ? null : Math.max(0, expiry - EXPIRY_MARGIN_MS - now);
};

const SESSION_EXPIRED = "auth:session-expired";

/** Called from outside React (e.g. the API client) when the server rejects the token. */
export const signalSessionExpired = () => window.dispatchEvent(new Event(SESSION_EXPIRED));

export const onSessionExpired = (handler: () => void) => {
  window.addEventListener(SESSION_EXPIRED, handler);
  return () => window.removeEventListener(SESSION_EXPIRED, handler);
};
