import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { Facts, Pager, QueryView, RowsSkeleton, Section } from "@/components/editorial";
import { Artwork, ArtistLinks, MusicList, SpotifyLink, TrackRow } from "@/components/music";
import { formatReleaseDate, humanize } from "@/lib/format";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/albums/$id")({
  validateSearch: z.object({ page: z.number().int().min(1).max(500).default(1).catch(1) }),
  head: () => ({ meta: [{ title: "Album · Spotify Stats" }] }),
  component: AlbumDetail,
});

function AlbumDetail() {
  const { id } = Route.useParams();
  const { page } = Route.useSearch();
  const album = useQuery(orpc.spotify.album.get.queryOptions({ input: { id } }));
  const tracks = useQuery(orpc.spotify.album.tracks.queryOptions({ input: { id, page } }));

  return (
    <>
      <QueryView query={album} loading={<RowsSkeleton rows={3} />}>
        {(data) => (
          <header className="rise-in grid gap-8 border-b border-border pb-10 md:grid-cols-[auto_1fr] md:items-end">
            <Artwork images={data.images} alt={`Cover of ${data.name}`} size={280} className="max-w-full" />
            <div className="flex min-w-0 flex-col gap-6">
              <div>
                <p className="eyebrow">{humanize(data.album_type)}</p>
                <h1 className="mt-3 font-display text-4xl leading-[1.05] tracking-tight text-balance sm:text-6xl">
                  {data.name}
                </h1>
                <ArtistLinks artists={data.artists} className="mt-3 block text-xl" />
              </div>
              <Facts
                items={[
                  ["Released", formatReleaseDate(data.release_date, data.release_date_precision)],
                  ["Tracks", String(data.total_tracks)],
                  ...Object.entries(data.external_ids ?? {}).map(([key, value]) => [key.toUpperCase(), value] as [string, string]),
                ]}
              />
              <SpotifyLink href={data.external_urls?.spotify} className="self-start" />
            </div>
          </header>
        )}
      </QueryView>

      <Section number="01" title="Tracklist">
        <QueryView query={tracks} isEmpty={(d) => d.items.length === 0} empty="Spotify didn't return any tracks.">
          {(data) => (
            <div className="flex flex-col gap-6">
              <MusicList>
                {data.items.map((track, index) => (
                  <TrackRow key={`${track.id}-${index}`} track={track} rank={track.track_number} />
                ))}
              </MusicList>
              <Pager page={page} hasNext={Boolean(data.next)} />
            </div>
          )}
        </QueryView>
      </Section>

      {album.data?.copyrights?.length ? (
        <footer className="text-xs text-faint-foreground">
          {album.data.copyrights.map((copyright) => (
            <p key={copyright.text}>{copyright.text}</p>
          ))}
        </footer>
      ) : null}
    </>
  );
}
