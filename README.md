# Spotify Stats

A self-hosted companion for your Spotify account: top tracks and artists, recent plays, your library, playlists, search, detail pages for every track, album, and artist, and a live Now Playing page with play/pause/skip (Spotify Premium required for controls). Spotify is the only login, and nothing is stored on the server.

## Two steps: bring your own Spotify app, then sign in

1. **Create a Spotify app** in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard). Choose the *Web API* and add this redirect URI exactly:

   ```
   <APP_URL>/auth/callback      e.g. http://127.0.0.1:3000/auth/callback
   ```

   Spotify requires HTTPS for redirect URIs, except loopback addresses such as `http://127.0.0.1`. `localhost` is not accepted. Development-mode apps are limited to a few allowlisted users, and the app owner needs Spotify Premium. To let someone else sign in, add their account under *User Management*.

2. **Run the container** with your app's client ID and click **Continue with Spotify**. No client secret is needed.

```bash
export APP_URL=http://127.0.0.1:3000
export SPOTIFY_CLIENT_ID=...
docker compose up -d --build
```

Or with plain Docker:

```bash
docker build -t spotify-stats .
docker run -d -p 3000:3000 -e APP_URL -e SPOTIFY_CLIENT_ID spotify-stats
```

| Variable | Purpose |
| --- | --- |
| `APP_URL` | Public URL of the installation, with no trailing slash. |
| `SPOTIFY_CLIENT_ID` | Client ID of your Spotify app. |
| `PORT` / `HOST` | Listen address inside the container (default `0.0.0.0:3000`). |

For anything other than local use, put the container behind an HTTPS reverse proxy (Caddy, Traefik, nginx) and set `APP_URL` to the public `https://` URL.

## How sign-in works

Sign-in uses the official SDK's [PKCE flow](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow), so no client secret is involved:

- **Continue with Spotify** runs `SpotifyApi.performUserAuthorization` in the browser. On `/auth/callback` the SDK exchanges the code and posts the token to `POST /auth/token`.
- The server checks the token with `/me` (accounts that aren't allowlisted get a clear message), then saves the token and basic profile in **one HttpOnly cookie** that lasts 30 days.
- Each request uses `SpotifyApi.withAccessToken`, which refreshes expired tokens; the new token is saved back to the cookie. `POST /auth/logout` (same-origin only) deletes the cookie.
- The private pages are protected twice: a route guard (`routes/_app.tsx`) and an oRPC `protectedProcedure` middleware that every Spotify procedure uses.

The server side lives in `apps/web/src/server/spotify-auth.ts`; the browser side in `apps/web/src/lib/login.ts`.

## What Spotify does and doesn't provide

The app shows only data Spotify supplies. Some of it is limited:

- **No BPM, key, time signature, or audio features.** Spotify removed these endpoints for new apps in November 2024.
- **Genres belong to artists**, not tracks, and are labeled that way.
- **Top lists** cover approximate windows (about 4 weeks, 6 months, or 1 year) and are Spotify's own rankings, not play counts.
- **Recent plays** include only the last 50 tracks.
- **Other people's playlists** may show metadata only.

## Development

```bash
bun install
# Create apps/web/.env with SPOTIFY_CLIENT_ID,
# and register http://127.0.0.1:3001/auth/callback in your Spotify app.
bun run dev                             # http://127.0.0.1:3001
```

| Script | Purpose |
| --- | --- |
| `bun run dev` | Start the dev server |
| `bun run build` | Production build (`apps/web/.output`) |
| `bun run test` | Unit tests (Vitest) |
| `bun run check-types` | TypeScript checks |

Project layout:

```
apps/web/          TanStack Start app (routes, components, auth)
packages/api/      oRPC routers calling the official @spotify/web-api-ts-sdk directly
packages/ui/       shared shadcn/ui (Base UI) primitives and design tokens
```

Not affiliated with or endorsed by Spotify. Content and artwork are provided by Spotify.