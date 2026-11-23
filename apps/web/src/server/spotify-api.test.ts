import { ORPCError, createRouterClient } from "@orpc/server";
import { appRouter } from "@spotify-stats/api/routers/index";
import { createSpotifyApi } from "@spotify-stats/api/spotify";
import type { SpotifyApi } from "@spotify/web-api-ts-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";

const session = { userId: "u", displayName: null, imageUrl: null };
const features = { sound: true };

/** Router context for a signed-in user (or signed out when `spotify` is null). */
function ctx(spotify: SpotifyApi | null, options = features) {
  return { getSession: async () => (spotify ? { user: session, spotify } : null), features: options };
}

/** Router client backed by the real SDK, with Spotify's HTTP responses stubbed. */
function clientWith(...responses: Response[]) {
  const fetch = vi.fn(async (_url: string, _init?: RequestInit) => responses.shift() ?? new Response(null, { status: 500 }));
  vi.stubGlobal("fetch", fetch);
  const spotify = createSpotifyApi("client-id", {
    access_token: "token-1",
    token_type: "Bearer",
    expires_in: 3600,
    refresh_token: "r",
    expires: Date.now() + 3_600_000,
  });
  return { client: createRouterClient(appRouter, { context: ctx(spotify) }), fetch };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("protected procedures", () => {
  const anonymous = createRouterClient(appRouter, { context: ctx(null) });

  it("reject callers without a session, including the server-side client", async () => {
    await expect(anonymous.spotify.profile()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(anonymous.spotify.top.tracks({ timeRange: "short_term", page: 1 })).rejects.toBeInstanceOf(ORPCError);
  });

  it("expose sign-in state without token material", async () => {
    expect(await anonymous.auth.session()).toBeNull();
    const signedIn = createRouterClient(appRouter, { context: ctx({} as SpotifyApi) });
    expect(await signedIn.auth.session()).toEqual(session);
  });

  it("validate Spotify IDs before calling Spotify", async () => {
    const get = vi.fn();
    const client = createRouterClient(appRouter, {
      context: ctx({ tracks: { get } } as unknown as SpotifyApi),
    });
    await expect(client.spotify.track({ id: "../me/player" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(get).not.toHaveBeenCalled();
  });

  it("skip sound lookups when SOUND_LOOKUPS is off", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const client = createRouterClient(appRouter, {
      context: ctx({} as SpotifyApi, { sound: false }),
    });
    expect(await client.features()).toEqual({ sound: false });
    await expect(client.spotify.sound({ id: "4uLU6hMCjMI75M1A2tKUQC" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("Spotify SDK", () => {
  it("calls Spotify with the session token", async () => {
    const { client, fetch } = clientWith(Response.json({ id: "u1", display_name: "Ada" }));
    await expect(client.spotify.profile()).resolves.toMatchObject({ id: "u1", display_name: "Ada" });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://api.spotify.com/v1/me");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer token-1");
  });

  it("maps Spotify failures to typed errors", async () => {
    const { client } = clientWith(new Response(null, { status: 403 }), new Response(null, { status: 429 }));
    await expect(client.spotify.profile()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(client.spotify.profile()).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("treats 204 playback as nothing playing", async () => {
    const { client } = clientWith(new Response(null, { status: 204 }));
    await expect(client.spotify.player.state()).resolves.toBeNull();
  });

  it("pauses playback on the given device, accepting Spotify's non-JSON reply", async () => {
    const { client, fetch } = clientWith(new Response("ok", { status: 200 }));
    await expect(client.spotify.player.pause({ deviceId: "device-1" })).resolves.toBeUndefined();
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://api.spotify.com/v1/me/player/pause?device_id=device-1");
    expect(init?.method).toBe("PUT");
  });

  it("starts the selected song on the active device", async () => {
    const { client, fetch } = clientWith(new Response(null, { status: 204 }));
    await client.spotify.player.play({ trackId: "4uLU6hMCjMI75M1A2tKUQC" });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://api.spotify.com/v1/me/player/play");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(String(init?.body))).toEqual({ uris: ["spotify:track:4uLU6hMCjMI75M1A2tKUQC"] });
  });

  it("still resumes playback without selecting a song", async () => {
    const { client, fetch } = clientWith(new Response(null, { status: 204 }));
    await client.spotify.player.play({ deviceId: "device-1" });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://api.spotify.com/v1/me/player/play?device_id=device-1");
    expect(JSON.parse(String(init?.body))).toEqual({});
  });

  it("rejects invalid song IDs and anonymous playback before calling Spotify", async () => {
    const { client, fetch } = clientWith();
    await expect(client.spotify.player.play({ trackId: "../me" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const anonymous = createRouterClient(appRouter, { context: ctx(null) });
    await expect(anonymous.spotify.player.play({ trackId: "4uLU6hMCjMI75M1A2tKUQC" }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reads playlist contents from the current /items endpoint", async () => {
    const { client, fetch } = clientWith(new Response(null, { status: 403 }));
    await expect(client.spotify.playlist.items({ id: "37i9dQZF1DXcBWIGoYBM5M", page: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(fetch.mock.calls[0]![0]).toContain("/playlists/37i9dQZF1DXcBWIGoYBM5M/items?");
  });

  it("requests artist albums within Spotify's 10-item limit", async () => {
    const { client, fetch } = clientWith(new Response(null, { status: 403 }));
    await client.spotify.artist.albums({ id: "0TnOYISbd1XYRBk9myaseg", page: 2 }).catch(() => {});
    const url = new URL(String(fetch.mock.calls[0]![0]));
    expect(url.searchParams.get("limit")).toBe("10");
    expect(url.searchParams.get("offset")).toBe("10");
  });
});