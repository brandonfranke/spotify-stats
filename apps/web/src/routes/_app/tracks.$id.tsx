import type { SimplifiedArtist } from "@spotify/web-api-ts-sdk";
import { Badge } from "@spotify-stats/ui/components/badge";
import { useQueries, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Facts, QueryView, RowsSkeleton, Section } from "@/components/editorial";
import { TrackArtwork, ArtistLinks, SpotifyLink } from "@/components/music";
import { SoundSection } from "@/components/sound";
import { formatDuration, formatReleaseDate, humanize } from "@/lib/format";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/tracks/$id")({
  head: () => ({ meta: [{ title: "Track · Spotify Stats" }] }),
  component: TrackDetail,
});

function TrackDetail() {
  const { id } = Route.useParams();
  const track = useQuery(orpc.spotify.track.queryOptions({ input: { id } }));
  const features = useQuery(orpc.features.queryOptions({ staleTime: Infinity }));

  return (
    <QueryView query={track} loading={<RowsSkeleton rows={4} />}>
      {(data) => (
        <>
          <header className="rise-in grid gap-8 border-b border-border pb-10 md:grid-cols-[auto_1fr] md:items-end">
            <TrackArtwork
              track={data}
              images={data.album.images}
              alt={`Cover of ${data.album.name}`}
              size={280}
              className="max-w-full"
            />
            <div className="min-w-0">
              <p className="eyebrow">Track{data.explicit ? " · Explicit" : ""}</p>
              <h1 className="mt-3 font-display text-4xl leading-[1.05] tracking-tight text-balance sm:text-6xl">
                {data.name}
              </h1>
              <ArtistLinks artists={data.artists} className="mt-3 block text-xl" />
              {data.album.id && (
                <p className="mt-2 text-muted-foreground">
                  from{" "}
                  <Link to="/albums/$id" params={{ id: data.album.id }} className="text-foreground hover:underline">
                    {data.album.name}
                  </Link>
                </p>
              )}
              <SpotifyLink href={data.external_urls?.spotify} label="Play on Spotify" className="mt-6" />
            </div>
          </header>

          <div className="grid gap-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <Section number="01" title="Liner notes">
              <Facts
                items={[
                  ["Duration", formatDuration(data.duration_ms)],
                  ["Released", formatReleaseDate(data.album.release_date, data.album.release_date_precision)],
                  ["Release type", humanize(data.album.album_type)],
                  ["Track", `${data.track_number} of ${data.album.total_tracks}`],
                  ["Disc", String(data.disc_number)],
                  ["Explicit", data.explicit ? "Yes" : "No"],
                  ...Object.entries(data.external_ids ?? {}).map(
                    ([key, value]) => [key.toUpperCase(), <code key={key} className="font-mono text-xs">{value}</code>] as [string, ReactNode],
                  ),
                  ["Spotify ID", <code key="id" className="font-mono text-xs">{data.id}</code>],
                ]}
              />
            </Section>

            <div className="flex flex-col gap-12">
              <ArtistGenres artists={data.artists} />
              {features.data?.sound && <SoundSection id={data.id} isrc={data.external_ids?.isrc} />}
            </div>
          </div>
        </>
      )}
    </QueryView>
  );
}

/** Spotify assigns genres to artists, not tracks, so they are labeled as such. */
function ArtistGenres({ artists }: { artists: SimplifiedArtist[] }) {
  const ids = artists.map((artist) => artist.id).slice(0, 3);
  const results = useQueries({
    queries: ids.map((id) => orpc.spotify.artist.get.queryOptions({ input: { id } })),
  });

  return (
    <Section number="02" title="Artist genres">
      <p className="text-sm text-muted-foreground">
        Spotify doesn't assign genres to individual songs. These genres belong to the artists.
      </p>
      {results.length === 0 && <p className="text-muted-foreground">No linked artists.</p>}
      <ul className="flex flex-col gap-4">
        {results.map((result, index) => (
          <li key={ids[index]} className="flex flex-col gap-2">
            {result.isPending ? (
              <span className="text-sm text-muted-foreground">Loading…</span>
            ) : result.data ? (
              <>
                <Link to="/artists/$id" params={{ id: ids[index]! }} className="font-medium hover:underline">
                  {result.data.name}
                </Link>
                {result.data.genres?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {result.data.genres.map((genre) => (
                      <Badge key={genre} variant="outline" className="capitalize">
                        {genre}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-faint-foreground">Spotify didn't list any genres.</span>
                )}
              </>
            ) : (
              <span className="text-sm text-faint-foreground">Couldn't load this artist.</span>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}
