import { Tabs, TabsList, TabsTrigger } from "@spotify-stats/ui/components/tabs";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { PageHeader, Pager, QueryView } from "@/components/editorial";
import { ArtistRow, MusicList, TrackRow } from "@/components/music";
import { TimeRangeTabs } from "@/components/time-range-tabs";
import { timeRangeLabel } from "@/lib/format";
import { orpc } from "@/utils/orpc";

const PAGE_SIZE = 20;

export const Route = createFileRoute("/_app/top")({
  validateSearch: z.object({
    type: z.enum(["tracks", "artists"]).default("tracks").catch("tracks"),
    range: z.enum(["short_term", "medium_term", "long_term"]).default("medium_term").catch("medium_term"),
    page: z.number().int().min(1).max(500).default(1).catch(1),
  }),
  head: () => ({ meta: [{ title: "Top charts · Spotify Stats" }] }),
  component: Top,
});

function Top() {
  const { type, range, page } = Route.useSearch();
  const navigate = Route.useNavigate();
  const input = { input: { timeRange: range, page } };
  const tracks = useQuery({ ...orpc.spotify.top.tracks.queryOptions(input), enabled: type === "tracks" });
  const artists = useQuery({ ...orpc.spotify.top.artists.queryOptions(input), enabled: type === "artists" });
  const start = (page - 1) * PAGE_SIZE + 1;

  return (
    <>
      <PageHeader eyebrow="Top charts" title={type === "tracks" ? "Your top tracks" : "Your top artists"}>
        Ranked by Spotify for {timeRangeLabel(range).toLowerCase()}. Spotify computes these rankings
        and doesn't share play counts or exact dates.
      </PageHeader>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={type}
          onValueChange={(next) => navigate({ search: (prev) => ({ ...prev, type: next as "tracks" | "artists", page: 1 }) })}
        >
          <TabsList aria-label="Chart type">
            <TabsTrigger value="tracks" className="min-h-10 px-4">Tracks</TabsTrigger>
            <TabsTrigger value="artists" className="min-h-10 px-4">Artists</TabsTrigger>
          </TabsList>
        </Tabs>
        <TimeRangeTabs
          value={range}
          onChange={(next) => navigate({ search: (prev) => ({ ...prev, range: next, page: 1 }) })}
        />
      </div>

      {type === "tracks" ? (
        <QueryView query={tracks} isEmpty={(d) => d.items.length === 0} empty="Spotify hasn't ranked any tracks for this window.">
          {(data) => (
            <div className="flex flex-col gap-6">
              <MusicList start={start}>
                {data.items.map((track, index) => (
                  <TrackRow key={`${track.id}-${index}`} track={track} rank={start + index} />
                ))}
              </MusicList>
              <Pager page={page} hasNext={Boolean(data.next)} />
            </div>
          )}
        </QueryView>
      ) : (
        <QueryView query={artists} isEmpty={(d) => d.items.length === 0} empty="Spotify hasn't ranked any artists for this window.">
          {(data) => (
            <div className="flex flex-col gap-6">
              <MusicList start={start}>
                {data.items.map((artist, index) => (
                  <ArtistRow key={`${artist.id}-${index}`} artist={artist} rank={start + index} />
                ))}
              </MusicList>
              <Pager page={page} hasNext={Boolean(data.next)} />
            </div>
          )}
        </QueryView>
      )}
    </>
  );
}
