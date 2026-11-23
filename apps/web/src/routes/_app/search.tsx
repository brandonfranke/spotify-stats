import { InputGroup, InputGroupAddon, InputGroupInput } from "@spotify-stats/ui/components/input-group";
import { Tabs, TabsList, TabsTrigger } from "@spotify-stats/ui/components/tabs";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";

import { EmptyNote, PageHeader, Pager, QueryView } from "@/components/editorial";
import { AlbumCard, AlbumGrid, ArtistRow, MusicList, TrackRow } from "@/components/music";
import { orpc } from "@/utils/orpc";

const types = ["track", "artist", "album"] as const;
type SearchKind = (typeof types)[number];

export const Route = createFileRoute("/_app/search")({
  validateSearch: z.object({
    q: z.string().max(200).default("").catch(""),
    type: z.enum(types).default("track").catch("track"),
    page: z.number().int().min(1).max(100).default(1).catch(1),
  }),
  head: () => ({ meta: [{ title: "Search · Spotify Stats" }] }),
  component: Search,
});

function Search() {
  const { q, type, page } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [draft, setDraft] = useState(q);

  useEffect(() => setDraft(q), [q]);
  useEffect(() => {
    if (draft.trim() === q.trim()) return;
    const timer = setTimeout(() => {
      navigate({ search: (prev) => ({ ...prev, q: draft, page: 1 }), replace: true });
    }, 350);
    return () => clearTimeout(timer);
  }, [draft, q, navigate]);

  const query = q.trim();
  const results = useQuery({
    ...orpc.spotify.search.queryOptions({ input: { query, page } }),
    enabled: query.length > 0,
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader eyebrow="Search" title="Look anything up">
        Search Spotify's catalog, then open a track, artist, or album for its full details.
      </PageHeader>

      <form
        role="search"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          navigate({ search: (prev) => ({ ...prev, q: draft, page: 1 }) });
        }}
      >
        <label htmlFor="search-input" className="eyebrow">
          Search the catalog
        </label>
        <InputGroup className="h-12 max-w-2xl">
          <InputGroupAddon>
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            id="search-input"
            type="search"
            value={draft}
            maxLength={200}
            autoComplete="off"
            placeholder="Song, artist or album"
            onChange={(event) => setDraft(event.target.value)}
            className="text-base"
          />
        </InputGroup>
        <Tabs value={type} onValueChange={(next) => navigate({ search: (prev) => ({ ...prev, type: next as SearchKind, page: 1 }) })}>
          <TabsList variant="line" aria-label="Result type">
            <TabsTrigger value="track" className="min-h-10 px-3">Tracks</TabsTrigger>
            <TabsTrigger value="artist" className="min-h-10 px-3">Artists</TabsTrigger>
            <TabsTrigger value="album" className="min-h-10 px-3">Albums</TabsTrigger>
          </TabsList>
        </Tabs>
      </form>

      {query.length === 0 ? (
        <EmptyNote>Type something to search Spotify.</EmptyNote>
      ) : (
        <QueryView query={results} isEmpty={(d) => d[`${type}s`].items.length === 0} empty={`No results for “${query}”.`}>
          {(data) => {
            const start = (page - 1) * 10 + 1;
            return (
              <div className="flex flex-col gap-6" aria-live="polite">
                {type === "track" && (
                  <MusicList start={start}>
                    {data.tracks.items.map((track, index) => (
                      <TrackRow key={`${track.id}-${index}`} track={track} />
                    ))}
                  </MusicList>
                )}
                {type === "artist" && (
                  <MusicList start={start}>
                    {data.artists.items.map((artist, index) => (
                      <ArtistRow key={`${artist.id}-${index}`} artist={artist} />
                    ))}
                  </MusicList>
                )}
                {type === "album" && (
                  <AlbumGrid>
                    {data.albums.items.map((album, index) => (
                      <AlbumCard key={`${album.id}-${index}`} album={album} />
                    ))}
                  </AlbumGrid>
                )}
                <Pager page={page} hasNext={Boolean(data[`${type}s`].next) && page < 100} />
              </div>
            );
          }}
        </QueryView>
      )}
    </>
  );
}
