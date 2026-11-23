/**
 * Spotify login with the authorization code flow:
 * https://developer.spotify.com/documentation/web-api/tutorials/code-flow
 *
 * GET /auth/login sends the browser to Spotify with a random `state`, GET /auth/callback
 * exchanges the returned code for tokens, and getSession() refreshes them before they expire.
 * The tokens and basic profile live in one HttpOnly cookie; nothing is stored on the server.
 */
import { ORPCError } from "@orpc/server";
import type { AccessToken } from "@spotify/web-api-ts-sdk";
import type { SessionPrincipal } from "@spotify-stats/api/context";
import { createSpotifyApi } from "@spotify-stats/api/spotify";
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";

import { ENV } from "@/env.server";
import { SCOPES } from "@/lib/scopes";

type Session = { user: SessionPrincipal; token: AccessToken };

const SESSION_COOKIE = "spotify-stats-session";
const STATE_COOKIE = "spotify-stats-state";

export function config() {
  const { APP_URL, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = ENV;
  if (!APP_URL || !SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    throw new Error("Spotify login is not configured: set APP_URL, SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET");
  }
  return {
    appUrl: APP_URL,
    clientId: SPOTIFY_CLIENT_ID,
    clientSecret: SPOTIFY_CLIENT_SECRET,
    redirectUri: `${APP_URL}/auth/callback`,
  };
}

function cookieOptions() {
  return { httpOnly: true, secure: config().appUrl.startsWith("https://"), sameSite: "lax", path: "/" } as const;
}

function readSession(): Session | null {
  try {
    return JSON.parse(getCookie(SESSION_COOKIE) ?? "null");
  } catch {
    return null;
  }
}

function writeSession({ user, token }: Session) {
  const { access_token, token_type, expires_in, refresh_token, expires } = token;
  setCookie(
    SESSION_COOKIE,
    JSON.stringify({ user, token: { access_token, token_type, expires_in, refresh_token, expires } }),
    { ...cookieOptions(), maxAge: 30 * 24 * 60 * 60 },
  );
}

function redirectTo(location: string) {
  return new Response(null, { status: 302, headers: { Location: location } });
}

/** Only accept state-changing requests made by this app's own pages. */
export function isSameOrigin(request: Request) {
  return request.headers.get("origin") === new URL(config().appUrl).origin;
}

/** GET /auth/login: send the browser to Spotify's consent page. */
export function handleLogin() {
  const { clientId, redirectUri } = config();
  // Checked on the way back so another site can't sign this browser into its own account.
  const state = crypto.randomUUID();
  setCookie(STATE_COOKIE, state, { ...cookieOptions(), maxAge: 10 * 60 });
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: Object.keys(SCOPES).join(" "),
    redirect_uri: redirectUri,
    state,
  });
  return redirectTo(`https://accounts.spotify.com/authorize?${params}`);
}

/** GET /auth/callback: Spotify sends the browser back here with ?code or ?error. */
export async function handleCallback(request: Request) {
  const params = new URL(request.url).searchParams;
  const state = getCookie(STATE_COOKIE);
  deleteCookie(STATE_COOKIE, cookieOptions());

  if (params.has("error")) return redirectTo("/?error=denied");
  const code = params.get("code");
  if (!code || !state || params.get("state") !== state) return redirectTo("/?error=token");

  try {
    const token = await requestToken({ grant_type: "authorization_code", code, redirect_uri: config().redirectUri });
    const profile = await createSpotifyApi(config().clientId, token).currentUser.profile();
    writeSession({
      user: { userId: profile.id, displayName: profile.display_name ?? null, imageUrl: profile.images?.[0]?.url ?? null },
      token,
    });
    return redirectTo("/overview");
  } catch (error) {
    console.error("Spotify sign-in failed:", error instanceof Error ? error.message : error);
    // Development-mode apps let non-allowlisted users finish OAuth, but then return 403.
    const forbidden = error instanceof ORPCError && error.code === "FORBIDDEN";
    return redirectTo(forbidden ? "/?error=not_allowlisted" : "/?error=token");
  }
}

/** POST /auth/logout */
export function handleLogout(request: Request) {
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });
  deleteCookie(SESSION_COOKIE, cookieOptions());
  return new Response(null, { status: 303, headers: { Location: "/" } });
}

class SessionRejected extends Error {}

/** POST to Spotify's token endpoint, authenticated with the app's client ID and secret. */
async function requestToken(params: Record<string, string>): Promise<AccessToken> {
  const { clientId, clientSecret } = config();
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(10_000),
  });
  // 400 is invalid_grant: the code or refresh token was revoked, expired or already used.
  if (response.status === 400) throw new SessionRejected();
  if (!response.ok) throw new Error(`Spotify token request failed (${response.status})`);
  const token = (await response.json()) as AccessToken;
  return { ...token, expires: Date.now() + token.expires_in * 1000 };
}

/** Refresh tokens this many ms before expiry, so a token stays valid for the whole request. */
const REFRESH_MARGIN = 60_000;
/** Overlapping requests still carrying the old cookie reuse a finished refresh for this long. */
const REFRESH_REUSE = 30_000;

const refreshes = new Map<string, Promise<AccessToken>>();

/** One refresh per refresh token, shared by concurrent requests (Spotify may rotate it). */
function refreshToken(refresh: string) {
  let pending = refreshes.get(refresh);
  if (!pending) {
    pending = requestToken({ grant_type: "refresh_token", refresh_token: refresh }).then((token) => ({
      ...token,
      // Spotify may omit refresh_token on refresh, meaning "keep using the old one".
      refresh_token: token.refresh_token || refresh,
    }));
    refreshes.set(refresh, pending);
    pending.then(
      () => setTimeout(() => refreshes.delete(refresh), REFRESH_REUSE),
      () => refreshes.delete(refresh),
    );
  }
  return pending;
}

/**
 * The signed-in user and an SDK bound to a token that is valid for at least a
 * minute, or null when signed out. Throws a retryable error if Spotify can't
 * be reached to refresh, so a hiccup doesn't look like a sign-out.
 */
export async function getSession() {
  const session = readSession();
  if (!session?.token?.access_token) return null;
  let { token } = session;
  if (!token.expires || token.expires - REFRESH_MARGIN < Date.now()) {
    try {
      token = await refreshToken(token.refresh_token);
    } catch (error) {
      if (error instanceof SessionRejected) {
        deleteCookie(SESSION_COOKIE, cookieOptions());
        return null;
      }
      console.error("Spotify token refresh failed:", error instanceof Error ? error.message : error);
      throw new ORPCError("SERVICE_UNAVAILABLE", { message: "Couldn't reach Spotify to renew your session." });
    }
    writeSession({ ...session, token });
  }
  return { user: session.user, spotify: createSpotifyApi(config().clientId, token) };
}
