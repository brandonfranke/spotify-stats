import { ORPCError } from "@orpc/client";
import { Alert, AlertDescription, AlertTitle } from "@spotify-stats/ui/components/alert";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { LockIcon } from "lucide-react";
import { z } from "zod";

import { PageHeader, Pager, QueryView, RowsSkeleton, Section } from "@/components/editorial";
import { Artwork, MusicList, SpotifyLink, TrackRow } from "@/components/music";
import { formatDate, plural } from "@/lib/format";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/playlists/$id")({
  validateSearch: z.object({ page: z.number().int().min(1).max(500).default(1).catch(1) }),
  head: () => ({ meta: [{ title: "Playlist · Spotify Stats" }] }),
  component: PlaylistDetail,
});

function PlaylistDetail() {
  const { id } = Route.useParams();
  const { page } = Route.useSearch();
  const playlist = useQuery(orpc.spotify.playlist.get.queryOptions({ input: { id } }));
  const items = useQuery(orpc.spotify.playlist.items.queryOptions({ input: { id, page } }));
  // Spotify only returns the contents of playlists the user owns or collaborates on.
  const restricted = items.error instanceof ORPCError && items.error.code === "FORBIDDEN";

  return (
    <>
      <QueryView query={playlist} loading={<RowsSkeleton rows={2} />}>
        {(data) => (
          <PageHeader
            eyebrow={data.collaborative ? "Collaborative playlist" : "Playlist"}
            title={data.name}
            aside={<Artwork images={data.images} alt={`Cover of ${data.name}`} size={200} />}
          >
            <div className="flex flex-col gap-4">
              {data.description && <p>{data.description}</p>}
              <p className="text-sm">
                {[data.owner?.display_name && `By ${data.owner.display_name}`, items.data && plural(items.data.total, "item"), data.public ? "Public" : "Private"]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <SpotifyLink href={data.external_urls?.spotify} className="self-start" />
            </div>
          </PageHeader>
        )}
      </QueryView>

      <Section number="01" title="Tracks">
        {restricted ? (
          <Restricted />
        ) : (
          <QueryView query={items} page={page} isEmpty={(d) => d.items.length === 0} empty="This playlist is empty.">
            {(data) => (
                <div className="flex flex-col gap-6">
                  <MusicList start={(page - 1) * 20 + 1}>
                    {data.items.map((entry, index) =>
                      entry.item ? (
                        <TrackRow
                          key={`${entry.item.id}-${index}`}
                          track={entry.item}
                          rank={(page - 1) * 20 + index + 1}
                          meta={`Added ${formatDate(entry.added_at)}`}
                        />
                      ) : (
                        <li key={`missing-${index}`} className="py-4 text-sm text-faint-foreground">
                          This item is no longer available.
                        </li>
                      ),
                    )}
                  </MusicList>
                  <Pager page={page} hasNext={Boolean(data.next)} />
                </div>
            )}
          </QueryView>
        )}
      </Section>
    </>
  );
}

function Restricted() {
  return (
    <Alert>
      <LockIcon aria-hidden="true" />
      <AlertTitle>Tracks aren't available here</AlertTitle>
      <AlertDescription>
        Spotify only lets this app read the tracks of playlists you own or collaborate on. Open it in
        Spotify to see what's inside.
      </AlertDescription>
    </Alert>
  );
}
