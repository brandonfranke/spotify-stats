import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const jar = vi.hoisted(() => new Map<string, string>());

vi.mock("@/env.server", () => ({
  ENV: { APP_URL: "https://stats.example.com", SPOTIFY_CLIENT_ID: "client-id" },
}));

vi.mock("@tanstack/react-start/server", () => ({
  getCookie: (name: string) => jar.get(name),
  setCookie: (name: string, value: string) => jar.set(name, value),
  deleteCookie: (name: string) => jar.delete(name),
}));

const auth = await import("./spotify-auth");

const token = { access_token: "at", token_type: "Bearer", expires_in: 3600, refresh_token: "rt", expires: Date.now() + 3_600_000 };
const user = { userId: "user1", displayName: "Ada", imageUrl: null };

function post(path: string, body?: unknown, origin = "https://stats.example.com") {
  return new Request(`https://stats.example.com${path}`, {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function stubSpotify(...responses: Response[]) {
  const fetch = vi.fn(async (_url: string, _init?: RequestInit) => responses.shift() ?? new Response(null, { status: 500 }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const stored = () => JSON.parse(jar.get("spotify-stats-session") ?? "null");

beforeEach(() => jar.clear());
afterEach(() => vi.unstubAllGlobals());

describe("POST /auth/token", () => {
  it("verifies the token with /me and stores the session", async () => {
    stubSpotify(Response.json({ id: "user1", display_name: "Ada", images: [] }));
    const response = await auth.handleToken(post("/auth/token", token));
    expect(response.status).toBe(204);
    expect(stored()).toMatchObject({ user, token: { access_token: "at", refresh_token: "rt" } });
  });

  it("rejects accounts that aren't allowlisted", async () => {
    stubSpotify(new Response(null, { status: 403 }));
    expect((await auth.handleToken(post("/auth/token", token))).status).toBe(403);
    expect(jar.size).toBe(0);
  });

  it("rejects tokens posted from other sites", async () => {
    const fetch = stubSpotify();
    expect((await auth.handleToken(post("/auth/token", token, "https://evil.example"))).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("POST /auth/logout", () => {
  it("only signs out same-origin requests", () => {
    jar.set("spotify-stats-session", JSON.stringify({ user, token }));
    expect(auth.handleLogout(post("/auth/logout", undefined, "https://evil.example")).status).toBe(403);
    expect(jar.size).toBe(1);
    expect(auth.handleLogout(post("/auth/logout")).status).toBe(303);
    expect(jar.size).toBe(0);
  });
});

describe("getSession", () => {
  it("is null when signed out or the cookie is garbage", async () => {
    expect(await auth.getSession()).toBeNull();
    jar.set("spotify-stats-session", "not json");
    expect(await auth.getSession()).toBeNull();
  });

  it("lets the SDK refresh an expired token and keeps the new one", async () => {
    jar.set("spotify-stats-session", JSON.stringify({ user, token: { ...token, expires: Date.now() - 1000 } }));
    const fetch = stubSpotify(Response.json({ access_token: "at2", token_type: "Bearer", expires_in: 3600, refresh_token: "rt2" }));
    expect(await auth.getSession()).toMatchObject({ user });
    expect(fetch.mock.calls[0]![0]).toBe("https://accounts.spotify.com/api/token");
    expect(stored().token).toMatchObject({ access_token: "at2", refresh_token: "rt2" });
  });

  it("keeps the old refresh token when Spotify doesn't send a new one", async () => {
    jar.set("spotify-stats-session", JSON.stringify({ user, token: { ...token, expires: Date.now() - 1000 } }));
    stubSpotify(Response.json({ access_token: "at2", token_type: "Bearer", expires_in: 3600 }));
    await auth.getSession();
    expect(stored().token).toMatchObject({ access_token: "at2", refresh_token: "rt" });
  });

  it("signs out when the refresh token is rejected", async () => {
    jar.set("spotify-stats-session", JSON.stringify({ user, token: { ...token, expires: Date.now() - 1000 } }));
    stubSpotify(Response.json({ error: "invalid_grant" }, { status: 400 }));
    expect(await auth.getSession()).toBeNull();
    expect(jar.size).toBe(0);
  });

  it("keeps the cookie when Spotify is temporarily unavailable", async () => {
    jar.set("spotify-stats-session", JSON.stringify({ user, token: { ...token, expires: Date.now() - 1000 } }));
    stubSpotify(new Response(null, { status: 503 }));
    expect(await auth.getSession()).toBeNull();
    expect(jar.size).toBe(1);
  });
});