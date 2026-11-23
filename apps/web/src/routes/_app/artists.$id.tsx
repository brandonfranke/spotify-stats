import { Badge } from "@spotify-stats/ui/components/badge";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { PageHeader, Pager, QueryView, RowsSkeleton, Section } from "@/components/editorial";
import { AlbumCard, AlbumGrid, Artwork, SpotifyLink } from "@/components/music";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/artists/$id")({
  validateSearch: z.object({ page: z.number().int().min(1).max(500).default(1).catch(1) }),
  head: () => ({ meta: [{ title: "Artist · Spotify Stats" }] }),
  component: ArtistDetail,
});

function ArtistDetail() {
  const { id } = Route.useParams();
  const { page } = Route.useSearch();
  const artist = useQuery(orpc.spotify.artist.get.queryOptions({ input: { id } }));
  const albums = useQuery(orpc.spotify.artist.albums.queryOptions({ input: { id, page } }));

  return (
    <>
      <QueryView query={artist} loading={<RowsSkeleton rows={2} />}>
        {(data) => (
          <PageHeader
            eyebrow="Artist"
            title={data.name}
            aside={
              <Artwork images={data.images} alt={`Photo of ${data.name}`} size={200} kind="artist" className="rounded-full" />
            }
          >
            <div className="flex flex-col gap-4">
              {data.genres?.length ? (
                <ul className="flex flex-wrap gap-2" aria-label="Genres">
                  {data.genres.map((genre) => (
                    <li key={genre}>
                      <Badge variant="outline" className="capitalize">{genre}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Spotify didn't list any genres for this artist.</p>
              )}
              <SpotifyLink href={data.external_urls?.spotify} className="self-start" />
            </div>
          </PageHeader>
        )}
      </QueryView>

      <Section number="01" title="Discography">
        <QueryView query={albums} isEmpty={(d) => d.items.length === 0} empty="Spotify didn't return any releases.">
          {(data) => (
            <div className="flex flex-col gap-6">
              <AlbumGrid>
                {data.items.map((album, index) => (
                  <AlbumCard key={`${album.id}-${index}`} album={album} />
                ))}
              </AlbumGrid>
              <Pager page={page} hasNext={Boolean(data.next)} />
            </div>
          )}
        </QueryView>
      </Section>
    </>
  );
}
