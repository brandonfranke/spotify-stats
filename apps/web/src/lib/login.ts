import { SpotifyApi } from "@spotify/web-api-ts-sdk";
import { createServerFn } from "@tanstack/react-start";

import { config } from "@/server/spotify-auth";

/** Scopes this app asks for, with what each one allows. */
export const SCOPES: Record<string, string> = {
  "user-read-private": "Your profile name and picture",
  "user-top-read": "Your top tracks and artists",
  "user-read-recently-played": "Your recently played tracks",
  "user-library-read": "Your saved tracks and albums",
  "user-follow-read": "Artists you follow",
  "playlist-read-private": "Your private playlists",
  "playlist-read-collaborative": "Collaborative playlists",
  "user-read-playback-state": "Your current playback and queue",
  "user-read-currently-playing": "What's currently playing",
  "user-modify-playback-state": "Play, pause, and skip on your devices",
};

/** What the browser needs to start the SDK's login flow. */
export const getLoginConfig = createServerFn().handler(() => {
  const { clientId, redirectUri } = config();
  return { clientId, redirectUri };
});

type LoginConfig = { clientId: string; redirectUri: string };

/**
 * Runs the SDK's PKCE login. On the landing page this redirects to Spotify; on the
 * callback page it exchanges the code and hands the token to the server.
 * Returns an error key for the landing page, or null when signed in.
 * The callback page handles Spotify's ?error (denied) before calling this.
 */
export async function login({ clientId, redirectUri }: LoginConfig): Promise<string | null> {
  let status = 0;
  try {
    await SpotifyApi.performUserAuthorization(clientId, redirectUri, Object.keys(SCOPES), async (token) => {
      const response = await fetch("/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(token),
      });
      status = response.status;
      // The server keeps the token in its cookie; don't leave a copy in localStorage.
      SpotifyApi.withUserAuthorization(clientId, redirectUri).logOut();
    });
  } catch (error) {
    console.error("Spotify sign-in failed:", error);
    return "token";
  }
  if (status === 403) return "not_allowlisted";
  return status === 204 ? null : "token";
}