import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const jar = vi.hoisted(() => new Map<string, string>());

vi.mock("@/env.server", () => ({
  ENV: { APP_URL: "https://stats.example.com", SPOTIFY_CLIENT_ID: "client-id", SPOTIFY_CLIENT_SECRET: "secret" },
}));

vi.mock("@tanstack/react-start/server", () => ({
  getCookie: (name: string) => jar.get(name),
  setCookie: (name: string, value: string) => jar.set(name, value),
  deleteCookie: (name: string) => jar.delete(name),
}));

const auth = await import("./spotify-auth");

const COOKIE = "spotify-stats-session";
const STATE = "spotify-stats-state";

const token = { access_token: "at", token_type: "Bearer", expires_in: 3600, refresh_token: "rt", expires: Date.now() + 3_600_000 };
const user = { userId: "user1", displayName: "Ada", imageUrl: null };

function post(path: string, origin = "https://stats.example.com") {
  return new Request(`https://stats.example.com${path}`, { method: "POST", headers: { origin } });
}

function stubSpotify(...responses: Response[]) {
  const fetch = vi.fn(async (_url: string, _init?: RequestInit) => responses.shift() ?? new Response(null, { status: 500 }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const stored = () => JSON.parse(jar.get(COOKIE) ?? "null");
const location = (response: Response) => response.headers.get("location");

beforeEach(() => jar.clear());
afterEach(() => vi.unstubAllGlobals());

describe("GET /auth/login", () => {
  it("redirects to Spotify with a state that is also kept in a cookie", () => {
    const url = new URL(location(auth.handleLogin())!);
    expect(url.origin + url.pathname).toBe("https://accounts.spotify.com/authorize");
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("redirect_uri")).toBe("https://stats.example.com/auth/callback");
    expect(url.searchParams.get("state")).toBe(jar.get(STATE));
  });
});

describe("GET /auth/callback", () => {
  const callback = (query: string) => auth.handleCallback(new Request(`https://stats.example.com/auth/callback?${query}`));

  it("exchanges the code with the client secret and stores the session", async () => {
    jar.set(STATE, "s1");
    const fetch = stubSpotify(
      Response.json({ access_token: "at", token_type: "Bearer", expires_in: 3600, refresh_token: "rt" }),
      Response.json({ id: "user1", display_name: "Ada", images: [] }),
    );
    expect(location(await callback("code=c1&state=s1"))).toBe("/overview");
    const init = fetch.mock.calls[0]![1]!;
    expect(new Headers(init.headers).get("authorization")).toBe(`Basic ${btoa("client-id:secret")}`);
    expect(String(init.body)).toContain("code=c1");
    expect(stored()).toMatchObject({ user, token: { access_token: "at", refresh_token: "rt" } });
    expect(jar.has(STATE)).toBe(false);
  });

  it("rejects a state that doesn't match the cookie without contacting Spotify", async () => {
    jar.set(STATE, "s1");
    const fetch = stubSpotify();
    expect(location(await callback("code=c1&state=forged"))).toBe("/?error=token");
    expect(fetch).not.toHaveBeenCalled();
    expect(jar.has(COOKIE)).toBe(false);
  });

  it("reports a declined consent", async () => {
    expect(location(await callback("error=access_denied"))).toBe("/?error=denied");
  });

  it("reports accounts that aren't allowlisted", async () => {
    jar.set(STATE, "s1");
    stubSpotify(Response.json({ access_token: "at", token_type: "Bearer", expires_in: 3600 }), new Response(null, { status: 403 }));
    expect(location(await callback("code=c1&state=s1"))).toBe("/?error=not_allowlisted");
    expect(jar.has(COOKIE)).toBe(false);
  });
});

describe("POST /auth/logout", () => {
  it("only signs out same-origin requests", () => {
    jar.set(COOKIE, JSON.stringify({ user, token }));
    expect(auth.handleLogout(post("/auth/logout", "https://evil.example")).status).toBe(403);
    expect(jar.size).toBe(1);
    expect(auth.handleLogout(post("/auth/logout")).status).toBe(303);
    expect(jar.size).toBe(0);
  });
});

describe("getSession", () => {
  // Finished refreshes are shared briefly, so each test uses its own refresh token.
  let refresh = 0;
  function expired() {
    const token = { ...base, refresh_token: `rt-${++refresh}`, expires: Date.now() - 1000 };
    jar.set(COOKIE, JSON.stringify({ user, token }));
    return token.refresh_token;
  }
  const base = token;

  it("is null when signed out or the cookie is garbage", async () => {
    expect(await auth.getSession()).toBeNull();
    jar.set(COOKIE, "not json");
    expect(await auth.getSession()).toBeNull();
  });

  it("uses a fresh token without contacting Spotify", async () => {
    jar.set(COOKIE, JSON.stringify({ user, token }));
    const fetch = stubSpotify();
    expect(await auth.getSession()).toMatchObject({ user });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refreshes a token that is about to expire and keeps the new one", async () => {
    jar.set(COOKIE, JSON.stringify({ user, token: { ...token, refresh_token: "rt-soon", expires: Date.now() + 30_000 } }));
    const fetch = stubSpotify(Response.json({ access_token: "at2", token_type: "Bearer", expires_in: 3600, refresh_token: "rt2" }));
    expect(await auth.getSession()).toMatchObject({ user });
    expect(fetch.mock.calls[0]![0]).toBe("https://accounts.spotify.com/api/token");
    expect(stored().token).toMatchObject({ access_token: "at2", refresh_token: "rt2" });
    expect(stored().token.expires).toBeGreaterThan(Date.now() + 3_000_000);
  });

  it("keeps the old refresh token when Spotify doesn't send a new one", async () => {
    const old = expired();
    stubSpotify(Response.json({ access_token: "at2", token_type: "Bearer", expires_in: 3600 }));
    await auth.getSession();
    expect(stored().token).toMatchObject({ access_token: "at2", refresh_token: old });
  });

  it("shares one refresh between concurrent requests", async () => {
    expired();
    const fetch = stubSpotify(Response.json({ access_token: "at2", token_type: "Bearer", expires_in: 3600 }));
    const sessions = await Promise.all([auth.getSession(), auth.getSession(), auth.getSession()]);
    expect(sessions.every((session) => session?.user.userId === "user1")).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("signs out when the refresh token is rejected", async () => {
    expired();
    stubSpotify(Response.json({ error: "invalid_grant" }, { status: 400 }));
    expect(await auth.getSession()).toBeNull();
    expect(jar.size).toBe(0);
  });

  it("reports a retryable error, not a sign-out, when Spotify is unavailable", async () => {
    expired();
    stubSpotify(new Response(null, { status: 503 }));
    await expect(auth.getSession()).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    expect(jar.size).toBe(1);
  });
});