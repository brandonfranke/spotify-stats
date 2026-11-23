import type { SpotifyApi } from "@spotify/web-api-ts-sdk";

/** Sanitized identity of a signed-in Spotify account. Never contains tokens. */
export type SessionPrincipal = {
  userId: string;
  displayName: string | null;
  imageUrl: string | null;
};

/** A signed-in user plus an SDK bound to their (fresh) token. */
export type Session = { user: SessionPrincipal; spotify: SpotifyApi };

/** Created per request by the host app. */
export type Context = {
  /**
   * Resolves the session, refreshing its token if needed. Null when signed out;
   * throws a retryable error when Spotify can't be reached. Resolved lazily so
   * public procedures never touch Spotify.
   */
  getSession: () => Promise<Session | null>;
  features: Features;
};

/** Optional features the operator can switch off. `sound`: ReccoBeats/Deezer lookups (SOUND_LOOKUPS). */
export type Features = { sound: boolean };
