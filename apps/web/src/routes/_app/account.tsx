import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { LogoutButton } from "@/components/app-shell";
import { Facts, PageHeader, QueryView, Section } from "@/components/editorial";
import { Artwork, SpotifyLink } from "@/components/music";
import { SCOPES } from "@/lib/login";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/account")({
  head: () => ({ meta: [{ title: "Account · Spotify Stats" }] }),
  component: Account,
});

function Account() {
  const profile = useQuery(orpc.spotify.profile.queryOptions());

  return (
    <>
      <PageHeader eyebrow="Account" title="You & this app" />

      <Section number="01" title="Connected Spotify account">
        <QueryView query={profile}>
          {(data) => (
            <div className="flex flex-wrap items-center gap-6">
              <Artwork images={data.images} alt="" size={96} kind="artist" className="rounded-full" />
              <div className="flex flex-col gap-2">
                <span className="font-display text-3xl">{data.display_name ?? data.id}</span>
                <code className="font-mono text-xs text-muted-foreground">{data.id}</code>
                <SpotifyLink href={data.external_urls?.spotify} label="Open profile" className="self-start" />
              </div>
            </div>
          )}
        </QueryView>
      </Section>

      <Section number="02" title="What this app can read">
        <ul className="divide-y divide-border border-y border-border">
          {Object.entries(SCOPES).map(([scope, label]) => (
            <li key={scope} className="flex flex-wrap justify-between gap-2 py-3">
              <span>{label}</span>
              <code className="font-mono text-xs text-faint-foreground">{scope}</code>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">Apart from play, pause, and skip, all access is read-only. This app never changes your library or playlists.</p>
      </Section>

      <Section number="03" title="Session & privacy">
        <Facts
          items={[
            ["Stored", "A cookie in this browser only"],
            ["Listening history", "Never saved"],
          ]}
        />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <LogoutButton className="w-fit border border-border" />
          <Link to="/privacy" className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
            Read the privacy notes
          </Link>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Signing out removes the session from this browser. To revoke this app's access completely,
          open{" "}
          <a
            href="https://www.spotify.com/account/apps/"
            target="_blank"
            rel="noreferrer noopener"
            className="text-foreground underline underline-offset-4"
          >
            Manage apps in your Spotify account
          </a>{" "}
          and remove it.
        </p>
      </Section>
    </>
  );
}
