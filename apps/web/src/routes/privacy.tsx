import { createFileRoute, Link } from "@tanstack/react-router";

import { SpotifyAttribution } from "@/components/app-shell";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy · Spotify Stats" }] }),
  component: Privacy,
});

const sections: [string, string][] = [
  [
    "What this app reads",
    "With your permission, it reads your Spotify profile name and picture, top tracks and artists, recently played tracks, saved tracks and albums, followed artists, playlists, and current playback and queue. It can play, pause, and skip on your devices when you ask it to, but never changes your library or playlists.",
  ],
  [
    "What is stored",
    "Only your sign-in session: an HttpOnly cookie in your browser that holds your Spotify access tokens and basic profile. The server doesn't keep a database, files, or a listening history. Pages fetch fresh data from Spotify and keep it in memory briefly to avoid duplicate requests.",
  ],
  [
    "How long it lasts",
    "The session cookie expires after 30 days, or when you sign out.",
  ],
  [
    "Removing access",
    "Signing out deletes the session cookie from this browser. To revoke this app's access entirely, open your Spotify account page, go to “Manage apps”, and remove this app.",
  ],
  [
    "Who runs this",
    "This is a self-hosted instance run by whoever deployed it, using their own Spotify developer app. It isn't operated or endorsed by Spotify.",
  ],
];

function Privacy() {
  return (
    <div className="paper flex min-h-svh flex-col">
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <Link to="/" className="eyebrow hover:text-foreground">
          ← Spotify Stats
        </Link>
        <h1 className="mt-6 font-display text-5xl tracking-tight sm:text-6xl">Privacy</h1>
        <div className="mt-12 flex flex-col border-t border-border">
          {sections.map(([title, body], index) => (
            <section key={title} className="grid gap-2 border-b border-border py-6 sm:grid-cols-[12rem_1fr] sm:gap-8">
              <h2 className="font-display text-xl">
                <span className="eyebrow tabular mr-2 font-sans">{String(index + 1).padStart(2, "0")}</span>
                {title}
              </h2>
              <p className="text-muted-foreground">{body}</p>
            </section>
          ))}
        </div>
      </main>
      <SpotifyAttribution />
    </div>
  );
}
