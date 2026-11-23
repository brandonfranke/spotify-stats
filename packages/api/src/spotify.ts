import { ORPCError } from "@orpc/server";
import { SpotifyApi, type AccessToken, type Episode, type Track } from "@spotify/web-api-ts-sdk";

/** Spotify renamed playlist `tracks[].track` to `items[].item` (Feb 2026); the SDK predates this. */
export type PlaylistItem = { added_at: string; item: Track | Episode | null };

const errorCodes: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  429: "TOO_MANY_REQUESTS",
};

/** The official Spotify SDK for a user's token. Failed responses become oRPC errors. */
export function createSpotifyApi(clientId: string, token: AccessToken) {
  return SpotifyApi.withAccessToken(clientId, token, {
    responseValidator: {
      async validateResponse(response) {
        if (!response.ok) throw new ORPCError(errorCodes[response.status] ?? "BAD_GATEWAY");
      },
    },
    // Player commands can answer 200 with a non-JSON body, which the SDK's default deserializer fails to parse.
    deserializer: {
      async deserialize<T>(response: Response) {
        return (response.headers.get("content-type")?.includes("json") ? await response.json() : null) as T;
      },
    },
  });
}