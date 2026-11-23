import type { SpotifyApi } from "@spotify/web-api-ts-sdk";

/** Sanitized identity of a signed-in Spotify account. Never contains tokens. */
export type SessionPrincipal = {
  userId: string;
  displayName: string | null;
  imageUrl: string | null;
};

/** Created per request by the host app: the session plus an SDK bound to its token. */
export type Context = {
  session: SessionPrincipal | null;
  spotify: SpotifyApi | null;
};
