/**
 * Spotify login with the official SDK's PKCE flow.
 *
 * The browser runs `SpotifyApi.performUserAuthorization` (see lib/login.ts), then
 * posts the token here. The token and basic profile live in one HttpOnly cookie;
 * nothing is stored on the server. getSession() refreshes tokens shortly before they expire.
 */
import { ORPCError } from "@orpc/server";
import type { AccessToken } from "@spotify/web-api-ts-sdk";
import type { SessionPrincipal } from "@spotify-stats/api/context";
import { createSpotifyApi } from "@spotify-stats/api/spotify";
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";

import { ENV } from "@/env.server";

const SESSION_COOKIE = "spotify-stats-session";

type Session = { user: SessionPrincipal; token: AccessToken };

export function config() {
  const { APP_URL, SPOTIFY_CLIENT_ID } = ENV;
  if (!APP_URL || !SPOTIFY_CLIENT_ID) {
    throw new Error("Spotify login is not configured: set APP_URL and SPOTIFY_CLIENT_ID");
  }
  return { appUrl: APP_URL, clientId: SPOTIFY_CLIENT_ID, redirectUri: `${APP_URL}/auth/callback` };
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
    {
      httpOnly: true,
      secure: config().appUrl.startsWith("https://"),
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    },
  );
}

/** Only accept auth requests made by this app's own pages. */
export function isSameOrigin(request: Request) {
  return request.headers.get("origin") === new URL(config().appUrl).origin;
}

/** POST /auth/token: the browser hands over the token from the SDK's login flow. */
export async function handleToken(request: Request) {
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });
  try {
    const token = (await request.json()) as AccessToken;
    const profile = await createSpotifyApi(config().clientId, token).currentUser.profile();
    writeSession({
      user: { userId: profile.id, displayName: profile.display_name ?? null, imageUrl: profile.images?.[0]?.url ?? null },
      token,
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Spotify sign-in failed:", error);
    // Development-mode apps let non-allowlisted users finish OAuth, but then return 403.
    const forbidden = error instanceof ORPCError && error.code === "FORBIDDEN";
    return new Response(null, { status: forbidden ? 403 : 400 });
  }
}

/** POST /auth/logout */
export function handleLogout(request: Request) {
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });
  deleteCookie(SESSION_COOKIE, { path: "/" });
  return new Response(null, { status: 303, headers: { Location: "/" } });
}

/** Refresh tokens this many ms before expiry, so a token stays valid for the whole request. */
const REFRESH_MARGIN = 60_000;
/** Overlapping requests still carrying the old cookie reuse a finished refresh for this long. */
const REFRESH_REUSE = 30_000;

class SessionRejected extends Error {}

const refreshes = new Map<string, Promise<AccessToken>>();

/** One refresh per refresh token, shared by concurrent requests (Spotify may rotate it). */
function refreshToken(refresh: string) {
  let pending = refreshes.get(refresh);
  if (!pending) {
    pending = requestRefresh(refresh);
    refreshes.set(refresh, pending);
    pending.then(
      () => setTimeout(() => refreshes.delete(refresh), REFRESH_REUSE),
      () => refreshes.delete(refresh),
    );
  }
  return pending;
}

async function requestRefresh(refresh: string): Promise<AccessToken> {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh, client_id: config().clientId }),
    signal: AbortSignal.timeout(10_000),
  });
  // 400 is invalid_grant: the refresh token was revoked or already rotated away.
  if (response.status === 400) throw new SessionRejected();
  if (!response.ok) throw new Error(`Token refresh failed (${response.status})`);
  const token = (await response.json()) as AccessToken;
  return {
    ...token,
    // Spotify may omit refresh_token on refresh, meaning "keep using the old one".
    refresh_token: token.refresh_token || refresh,
    expires: Date.now() + token.expires_in * 1000,
  };
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
        deleteCookie(SESSION_COOKIE, { path: "/" });
        return null;
      }
      console.error("Spotify token refresh failed:", error instanceof Error ? error.message : error);
      throw new ORPCError("SERVICE_UNAVAILABLE", { message: "Couldn't reach Spotify to renew your session." });
    }
    writeSession({ ...session, token });
  }
  return { user: session.user, spotify: createSpotifyApi(config().clientId, token) };
}