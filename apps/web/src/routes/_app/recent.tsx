import { Button } from "@spotify-stats/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { RefreshCwIcon } from "lucide-react";
import { z } from "zod";

import { PageHeader, Pager, QueryView } from "@/components/editorial";
import { MusicList, TrackRow } from "@/components/music";
import { formatDateTime } from "@/lib/format";
import { orpc } from "@/utils/orpc";

const PAGE_SIZE = 20;

export const Route = createFileRoute("/_app/recent")({
  validateSearch: z.object({ page: z.number().int().min(1).max(3).default(1).catch(1) }),
  head: () => ({ meta: [{ title: "Recently played · Spotify Stats" }] }),
  component: Recent,
});

function Recent() {
  const { page } = Route.useSearch();
  const recent = useQuery(orpc.spotify.recent.queryOptions());

  return (
    <>
      <PageHeader
        eyebrow="Recently played"
        title="The last few records on the turntable"
        aside={
          <Button variant="outline" onClick={() => recent.refetch()} disabled={recent.isFetching} className="min-h-11">
            <RefreshCwIcon className={recent.isFetching ? "animate-spin" : ""} aria-hidden="true" />
            Refresh
          </Button>
        }
      >
        Spotify returns up to your 50 most recent track plays. It doesn't include podcasts or a full
        listening history. Times are shown in your local time zone.
      </PageHeader>

      <QueryView query={recent} isEmpty={(d) => d.items.length === 0} empty="Spotify didn't return any recent plays.">
        {(data) => {
          const start = (page - 1) * PAGE_SIZE;
          const items = data.items.slice(start, start + PAGE_SIZE);
          return (
            <div className="flex flex-col gap-6">
              <MusicList>
                {items.map((play) => (
                  <TrackRow
                    key={`${play.played_at}-${play.track.id}`}
                    track={play.track}
                    meta={<time dateTime={play.played_at}>{formatDateTime(play.played_at)}</time>}
                  />
                ))}
              </MusicList>
              <Pager page={page} hasNext={start + PAGE_SIZE < data.items.length} label={`Page ${page} of ${Math.max(1, Math.ceil(data.items.length / PAGE_SIZE))}`} />
            </div>
          );
        }}
      </QueryView>
    </>
  );
}
