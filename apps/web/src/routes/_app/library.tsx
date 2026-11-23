import { Tabs, TabsList, TabsTrigger } from "@spotify-stats/ui/components/tabs";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRightIcon } from "lucide-react";
import { z } from "zod";

import { PageHeader, Pager, QueryView } from "@/components/editorial";
import { AlbumCard, AlbumGrid, ArtistRow, Artwork, MusicList, TrackRow } from "@/components/music";
import { formatDate, plural } from "@/lib/format";
import { orpc } from "@/utils/orpc";

const tabs = ["tracks", "albums", "playlists", "artists"] as const;
type LibraryTab = (typeof tabs)[number];
const labels: Record<LibraryTab, string> = {
  tracks: "Saved tracks",
  albums: "Saved albums",
  playlists: "Playlists",
  artists: "Followed artists",
};

export const Route = createFileRoute("/_app/library")({
  validateSearch: z.object({
    tab: z.enum(tabs).default("tracks").catch("tracks"),
    page: z.number().int().min(1).max(500).default(1).catch(1),
    after: z.string().regex(/^[0-9A-Za-z]{22}$/).optional().catch(undefined),
  }),
  head: () => ({ meta: [{ title: "Library · Spotify Stats" }] }),
  component: Library,
});

function Library() {
  const { tab, page, after } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <>
      <PageHeader eyebrow="Library" title="Everything you've kept">
        Your saved music, playlists, and followed artists, in the order Spotify returns them.
      </PageHeader>
      <Tabs value={tab} onValueChange={(next) => navigate({ search: { tab: next as LibraryTab, page: 1 } })}>
        <TabsList variant="line" aria-label="Library section" className="flex-wrap">
          {tabs.map((value) => (
            <TabsTrigger key={value} value={value} className="min-h-10 px-3">
              {labels[value]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {tab === "tracks" && <SavedTracks page={page} />}
      {tab === "albums" && <SavedAlbums page={page} />}
      {tab === "playlists" && <Playlists page={page} />}
      {tab === "artists" && <FollowedArtists after={after} />}
    </>
  );
}

function Total({ total, noun }: { total: number; noun: string }) {
  return <p className="tabular text-sm text-muted-foreground">{plural(total, noun)} reported by Spotify</p>;
}

function SavedTracks({ page }: { page: number }) {
  const query = useQuery(orpc.spotify.library.tracks.queryOptions({ input: { page } }));
  return (
    <QueryView query={query} isEmpty={(d) => d.items.length === 0} empty="You haven't saved any tracks.">
      {(data) => (
        <div className="flex flex-col gap-4">
          <Total total={data.total} noun="saved track" />
          <MusicList>
            {data.items.map((entry, index) => (
              <TrackRow
                key={`${entry.track.id}-${index}`}
                track={entry.track}
                meta={`Saved ${formatDate(entry.added_at)}`}
              />
            ))}
          </MusicList>
          <Pager page={page} hasNext={Boolean(data.next)} />
        </div>
      )}
    </QueryView>
  );
}

function SavedAlbums({ page }: { page: number }) {
  const query = useQuery(orpc.spotify.library.albums.queryOptions({ input: { page } }));
  return (
    <QueryView query={query} isEmpty={(d) => d.items.length === 0} empty="You haven't saved any albums.">
      {(data) => (
        <div className="flex flex-col gap-6">
          <Total total={data.total} noun="saved album" />
          <AlbumGrid>
            {data.items.map((entry, index) => (
              <AlbumCard
                key={`${entry.album.id}-${index}`}
                album={entry.album}
                meta={`Saved ${formatDate(entry.added_at)}`}
              />
            ))}
          </AlbumGrid>
          <Pager page={page} hasNext={Boolean(data.next)} />
        </div>
      )}
    </QueryView>
  );
}

function Playlists({ page }: { page: number }) {
  const query = useQuery(orpc.spotify.library.playlists.queryOptions({ input: { page } }));
  return (
    <QueryView query={query} isEmpty={(d) => d.items.length === 0} empty="You don't have any playlists.">
      {(data) => (
        <div className="flex flex-col gap-4">
          <Total total={data.total} noun="playlist" />
          <ul className="divide-y divide-border border-y border-border">
            {data.items.map((playlist) => (
              <li key={playlist.id}>
                <Link
                  to="/playlists/$id"
                  params={{ id: playlist.id }}
                  className="group flex min-h-16 items-center gap-4 py-2 hover:bg-accent/40"
                >
                  <Artwork images={playlist.images} alt="" size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium group-hover:underline">{playlist.name}</div>
                    <div className="truncate text-sm text-muted-foreground">
                      {playlist.owner?.display_name && `By ${playlist.owner.display_name}`}
                    </div>
                  </div>
                  <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
          <Pager page={page} hasNext={Boolean(data.next)} />
        </div>
      )}
    </QueryView>
  );
}

function FollowedArtists({ after }: { after?: string }) {
  const query = useQuery(orpc.spotify.library.artists.queryOptions({ input: { after } }));
  return (
    <QueryView query={query} isEmpty={(d) => d.artists.items.length === 0} empty="You don't follow any artists.">
      {({ artists }) => (
        <div className="flex flex-col gap-4">
          <Total total={artists.total} noun="followed artist" />
          <MusicList>
            {artists.items.map((artist, index) => (
              <ArtistRow key={`${artist.id}-${index}`} artist={artist} />
            ))}
          </MusicList>
          <nav aria-label="Pagination" className="flex justify-between">
            {after ? (
              <Link to="." search={{ tab: "artists", page: 1 }} className="min-h-11 px-3 py-3 text-sm hover:bg-accent">
                Back to start
              </Link>
            ) : (
              <span />
            )}
            {artists.next ? (
              <Link
                to="."
                search={{ tab: "artists", page: 1, after: artists.items.at(-1)?.id }}
                className="min-h-11 px-3 py-3 text-sm hover:bg-accent"
              >
                More artists
              </Link>
            ) : (
              <span className="py-3 text-sm text-faint-foreground">End of list</span>
            )}
          </nav>
        </div>
      )}
    </QueryView>
  );
}
