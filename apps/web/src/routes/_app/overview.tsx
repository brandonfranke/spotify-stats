import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";

import { Facts, PageHeader, QueryView, Section } from "@/components/editorial";
import { TrackArtwork, ArtistLinks, ArtistRow, MusicList, SpotifyLink, TrackRow } from "@/components/music";
import { TimeRangeTabs } from "@/components/time-range-tabs";
import { formatDateTime, timeRangeLabel } from "@/lib/format";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/overview")({
  validateSearch: z.object({
    range: z.enum(["short_term", "medium_term", "long_term"]).default("medium_term").catch("medium_term"),
  }),
  head: () => ({ meta: [{ title: "Overview · Spotify Stats" }] }),
  component: Overview,
});

function Overview() {
  const { range } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { session } = Route.useRouteContext();

  const tracks = useQuery(orpc.spotify.top.tracks.queryOptions({ input: { timeRange: range, page: 1 } }));
  const artists = useQuery(orpc.spotify.top.artists.queryOptions({ input: { timeRange: range, page: 1 } }));
  const recent = useQuery(orpc.spotify.recent.queryOptions());
  const playback = useQuery(orpc.spotify.player.state.queryOptions());
  const savedTracks = useQuery(orpc.spotify.library.tracks.queryOptions({ input: { page: 1 } }));
  const savedAlbums = useQuery(orpc.spotify.library.albums.queryOptions({ input: { page: 1 } }));
  const playlists = useQuery(orpc.spotify.library.playlists.queryOptions({ input: { page: 1 } }));
  const followed = useQuery(orpc.spotify.library.artists.queryOptions({ input: {} }));

  const leadTrack = tracks.data?.items[0];

  return (
    <>
      <PageHeader
        eyebrow={`The ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })} edition`}
        title={<>Hello, {session.displayName ?? "listener"}.</>}
        aside={<TimeRangeTabs value={range} onChange={(next) => navigate({ search: { range: next } })} />}
      >
        Spotify's view of what you've been listening to most over {timeRangeLabel(range).toLowerCase()}.
        Rankings are Spotify's own, not play counts.
      </PageHeader>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Section
          number="01"
          title="Top tracks"
          action={<MoreLink to="/top" search={{ type: "tracks", range, page: 1 }} />}
        >
          <QueryView query={tracks} isEmpty={(d) => d.items.length === 0} empty="Spotify hasn't ranked any tracks for this window yet.">
            {(data) => (
              <>
                {leadTrack && (
                  <div className="rise-in flex flex-col gap-5 sm:flex-row sm:items-end">
                    <TrackArtwork
                      track={leadTrack}
                      images={leadTrack.album.images}
                      alt={`Cover of ${leadTrack.album.name}`}
                      size={200}
                    />
                    <div className="min-w-0">
                      <p className="eyebrow">Spotify's No. 1 for you</p>
                      {leadTrack.id ? (
                        <Link
                          to="/tracks/$id"
                          params={{ id: leadTrack.id }}
                          className="mt-2 block font-display text-4xl leading-tight hover:underline"
                        >
                          {leadTrack.name}
                        </Link>
                      ) : (
                        <p className="mt-2 font-display text-4xl">{leadTrack.name}</p>
                      )}
                      <ArtistLinks artists={leadTrack.artists} className="mt-1 block text-lg" />
                    </div>
                  </div>
                )}
                <MusicList start={2}>
                  {data.items.slice(1, 6).map((track, index) => (
                    <TrackRow key={`${track.id}-${index}`} track={track} rank={index + 2} />
                  ))}
                </MusicList>
              </>
            )}
          </QueryView>
        </Section>

        <Section
          number="02"
          title="Top artists"
          action={<MoreLink to="/top" search={{ type: "artists", range, page: 1 }} />}
        >
          <QueryView query={artists} isEmpty={(d) => d.items.length === 0} empty="Spotify hasn't ranked any artists for this window yet.">
            {(data) => (
              <MusicList>
                {data.items.slice(0, 8).map((artist, index) => (
                  <ArtistRow key={`${artist.id}-${index}`} artist={artist} rank={index + 1} />
                ))}
              </MusicList>
            )}
          </QueryView>
        </Section>
      </div>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Section number="03" title="Recently played" action={<MoreLink to="/recent" />}>
          <QueryView query={recent} isEmpty={(d) => d.items.length === 0} empty="No recent plays were returned by Spotify.">
            {(data) => (
              <MusicList>
                {data.items.slice(0, 5).map((play) => (
                  <TrackRow key={play.played_at} track={play.track} meta={formatDateTime(play.played_at)} />
                ))}
              </MusicList>
            )}
          </QueryView>
        </Section>

        <div className="flex flex-col gap-12">
          <Section number="04" title="Now playing" action={<MoreLink to="/player" />}>
            <QueryView query={playback} loading={<p className="text-muted-foreground">Checking…</p>}>
              {(data) =>
                data?.item ? (
                  <div className="flex flex-col gap-2">
                    <p className="eyebrow">{data.is_playing ? "Playing" : "Paused"}</p>
                    <MusicList>
                      <TrackRow track={data.item} compact />
                    </MusicList>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Nothing is playing on your Spotify devices right now.</p>
                )
              }
            </QueryView>
          </Section>

          <Section number="05" title="Your library" action={<MoreLink to="/library" />}>
            <Facts
              items={[
                ["Saved tracks", <Total key="tracks" query={savedTracks} value={savedTracks.data?.total} />],
                ["Saved albums", <Total key="albums" query={savedAlbums} value={savedAlbums.data?.total} />],
                ["Playlists", <Total key="playlists" query={playlists} value={playlists.data?.total} />],
                ["Followed artists", <Total key="artists" query={followed} value={followed.data?.artists.total} />],
              ]}
            />
            <p className="text-xs text-faint-foreground">Totals as reported by Spotify.</p>
          </Section>
        </div>
      </div>

      <SpotifyLink href={`https://open.spotify.com/user/${session.userId}`} label="Open your Spotify profile" className="self-start" />
    </>
  );
}

/** A Spotify-reported total, with a retry link instead of a stuck placeholder when it fails. */
function Total({ query, value }: { query: { isError: boolean; refetch: () => unknown }; value: number | undefined }) {
  if (query.isError) {
    return (
      <button type="button" className="text-destructive underline-offset-4 hover:underline" onClick={() => query.refetch()}>
        Couldn't load · Retry
      </button>
    );
  }
  return <>{value?.toLocaleString("en-US") ?? "…"}</>;
}

function MoreLink(props: { to: "/top" | "/recent" | "/player" | "/library"; search?: Record<string, unknown> }) {
  return (
    <Link
      to={props.to}
      search={props.search as never}
      className="min-h-9 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      See all
    </Link>
  );
}
