import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowRightIcon } from "lucide-react";
import { useEffect } from "react";
import { z } from "zod";

import { SpotifyAttribution } from "@/components/app-shell";
import { SpotifyIcon } from "@/components/music";
import { getLoginConfig, login } from "@/lib/login";

const loginErrors: Record<string, string> = {
  denied: "Spotify access was not granted, so nothing was connected.",
  not_allowlisted:
    "Spotify accepted the sign-in, but this account isn't allowed to use this app yet. The app owner must add your Spotify account to the app's allowlist in the Spotify Developer Dashboard.",
  token: "Spotify could not complete the sign-in. Check the app's client ID and redirect URI, then try again.",
};

export const Route = createFileRoute("/")({
  validateSearch: z.object({
    error: z.string().optional().catch(undefined),
  }),
  beforeLoad: async ({ context, search }) => {
    const session = await context.queryClient.ensureQueryData(
      context.orpc.auth.session.queryOptions(),
    );
    if (session && !search.error) throw redirect({ to: "/overview" });
  },
  loader: () => getLoginConfig(),
  component: Landing,
});

const promises = [
  ["Hands off your library", "Your library and playlists are never changed. The only control is play, pause, and skip."],
  ["Nothing stored", "Data is fetched live from Spotify for each page. Your listening history is never saved."],
  ["Yours to host", "This instance runs on its owner's own Spotify app. Your session lives in a cookie in this browser."],
];

function Landing() {
  const { error } = Route.useSearch();
  const config = Route.useLoaderData();
  const message = error ? (loginErrors[error] ?? "Sign-in failed. Please try again.") : null;

  // Sign-in must start on APP_URL's origin: the SDK keeps its PKCE verifier in that
  // origin's localStorage, and Spotify returns to APP_URL. Opening e.g. localhost
  // instead of 127.0.0.1 would otherwise fail the first sign-in.
  useEffect(() => {
    const canonical = new URL(config.redirectUri).origin;
    if (window.location.origin !== canonical) {
      window.location.replace(canonical + window.location.pathname + window.location.search);
    }
  }, [config.redirectUri]);

  return (
    <div className="paper flex min-h-svh flex-col">
      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-16 px-6 py-16 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:py-24">
        <div className="rise-in flex flex-col gap-8">
          <p className="eyebrow">A self-hosted listening journal · No. 01</p>
          <h1 className="font-display text-6xl leading-[0.95] tracking-tight text-balance sm:text-7xl lg:text-8xl">
            The liner notes to <em className="text-highlight">your</em> listening.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Your top tracks and artists, recent plays, library and the details behind every song,
            album and artist, straight from Spotify.
          </p>

          {message && (
            <div role="alert" className="max-w-xl border-l-2 border-destructive bg-destructive/10 px-4 py-3 text-sm">
              {message}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => void login(config)}
              className="group inline-flex min-h-12 cursor-pointer items-center gap-3 bg-primary px-6 text-base font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              <SpotifyIcon className="size-5 rounded-full bg-black" />
              Continue with Spotify
              <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </button>
            <Link to="/privacy" className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
              What this app can see
            </Link>
          </div>
        </div>

        <ol aria-label="How this app handles your data" className="flex flex-col border-t border-border">
          {promises.map(([title, body], index) => (
            <li
              key={title}
              className="rise-in grid grid-cols-[3rem_1fr] gap-4 border-b border-border py-6"
              style={{ animationDelay: `${120 + index * 80}ms` }}
            >
              <span className="tabular font-display text-3xl text-faint-foreground">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h2 className="font-display text-2xl">{title}</h2>
                <p className="mt-1 text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </main>
      <SpotifyAttribution />
    </div>
  );
}
