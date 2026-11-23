/**
 * Spotify login with the official SDK's PKCE flow.
 *
 * The browser runs `SpotifyApi.performUserAuthorization` (see lib/login.ts), then
 * posts the token here. The token and basic profile live in one HttpOnly cookie;
 * nothing is stored on the server. The SDK refreshes expired tokens itself.
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
function isSameOrigin(request: Request) {
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

/** The signed-in user and their Spotify client, or null when signed out. */
export async function getSession() {
  const session = readSession();
  if (!session) return null;
  const spotify = createSpotifyApi(config().clientId, session.token);
  try {
    // Refreshes an expired token; keep the new one for the next request.
    const { accessToken } = await spotify.authenticate();
    if (accessToken !== session.token) {
      // Spotify may omit refresh_token on refresh, meaning "keep using the old one".
      const refresh_token = accessToken.refresh_token || session.token.refresh_token;
      writeSession({ ...session, token: { ...accessToken, refresh_token } });
    }
  } catch (error) {
    // Only a rejected refresh token signs the user out; network or rate-limit errors keep the cookie.
    if (String(error).includes("invalid_grant")) deleteCookie(SESSION_COOKIE, { path: "/" });
    return null;
  }
  return { user: session.user, spotify };
}