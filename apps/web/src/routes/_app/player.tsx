import { Button } from "@spotify-stats/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon } from "lucide-react";

import { EmptyNote, Facts, PageHeader, QueryView, Section } from "@/components/editorial";
import { Artwork, ArtistLinks, MusicList, SpotifyLink, TrackRow } from "@/components/music";
import { formatDuration, humanize } from "@/lib/format";
import { client, getErrorStatus, orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/player")({
  head: () => ({ meta: [{ title: "Now playing · Spotify Stats" }] }),
  component: Player,
});

function Player() {
  // Polls while this tab is visible (TanStack Query pauses background tabs).
  const state = useQuery(orpc.spotify.player.state.queryOptions({ refetchInterval: 10_000 }));
  const queue = useQuery(orpc.spotify.player.queue.queryOptions({ refetchInterval: 10_000 }));

  return (
    <>
      <PageHeader eyebrow="Now playing" title="On the stereo">
        Your current Spotify playback, updated every 10 seconds.
      </PageHeader>

      <QueryView query={state} loading={<EmptyNote>Checking your devices…</EmptyNote>}>
        {(data) => {
          if (!data) return <EmptyNote>Nothing is playing on your Spotify devices right now.</EmptyNote>;
          const item = data.item;
          const images = item && ("album" in item ? item.album.images : item.images);
          return (
            <section aria-label="Current playback" className="grid gap-8 md:grid-cols-[auto_1fr] md:items-end">
              <Artwork images={images} alt={item ? `Artwork for ${item.name}` : "No item"} size={240} className="max-w-full" />
              <div className="flex min-w-0 flex-col gap-4">
                <p className="eyebrow">{data.is_playing ? "Playing" : "Paused"}</p>
                <h2 className="font-display text-4xl leading-tight">
                  {item?.name ?? `Playing ${humanize(data.currently_playing_type)}`}
                </h2>
                {item && "artists" in item && <ArtistLinks artists={item.artists} className="text-lg" />}
                {item && data.progress_ms !== null && (
                  <div className="flex max-w-md flex-col gap-1">
                    <div
                      role="progressbar"
                      aria-label="Playback position"
                      aria-valuemin={0}
                      aria-valuemax={item.duration_ms}
                      aria-valuenow={data.progress_ms}
                      className="h-1 bg-muted"
                    >
                      <div className="h-full bg-highlight" style={{ width: `${Math.min(100, (data.progress_ms / item.duration_ms) * 100)}%` }} />
                    </div>
                    <span className="tabular text-xs text-muted-foreground">
                      {formatDuration(data.progress_ms)} / {formatDuration(item.duration_ms)}
                    </span>
                  </div>
                )}
                <Facts
                  items={[
                    ["Device", `${data.device.name} · ${data.device.type}`],
                    ["Shuffle", data.shuffle_state ? "On" : "Off"],
                    ["Repeat", humanize(data.repeat_state)],
                    ...(data.context ? [["Playing from", humanize(data.context.type)] as [string, string]] : []),
                  ]}
                />
                {data.device.id && !data.device.is_restricted && (
                  <Controls deviceId={data.device.id} isPlaying={data.is_playing} />
                )}
                <SpotifyLink href={item?.external_urls?.spotify} className="self-start" />
              </div>
            </section>
          );
        }}
      </QueryView>

      <Section number="01" title="Up next">
        <QueryView query={queue} isEmpty={(d) => d.queue.length === 0} empty="Your queue is empty.">
          {(data) => (
            <MusicList>
              {data.queue.slice(0, 20).map((item, index) => (
                <TrackRow key={`${item.id}-${index}`} track={item} rank={index + 1} />
              ))}
            </MusicList>
          )}
        </QueryView>
      </Section>
    </>
  );
}

function Controls({ deviceId, isPlaying }: { deviceId: string; isPlaying: boolean }) {
  const queryClient = useQueryClient();
  const control = useMutation({
    mutationFn: (action: "play" | "pause" | "next" | "previous") => client.spotify.player[action]({ deviceId }),
    // Spotify's playback state takes a moment to reflect a command. Stay busy until the
    // refreshed state arrives, so the play/pause toggle never sends a stale command.
    onSettled: async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await queryClient.invalidateQueries({ queryKey: orpc.spotify.player.key() });
    },
  });
  const busy = control.isPending;
  const error = control.error;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button variant="outline" size="icon" className="size-11" aria-label="Previous" disabled={busy} onClick={() => control.mutate("previous")}>
          <SkipBackIcon aria-hidden="true" />
        </Button>
        {isPlaying ? (
          <Button size="icon" className="size-11" aria-label="Pause" disabled={busy} onClick={() => control.mutate("pause")}>
            <PauseIcon aria-hidden="true" />
          </Button>
        ) : (
          <Button size="icon" className="size-11" aria-label="Play" disabled={busy} onClick={() => control.mutate("play")}>
            <PlayIcon aria-hidden="true" />
          </Button>
        )}
        <Button variant="outline" size="icon" className="size-11" aria-label="Next" disabled={busy} onClick={() => control.mutate("next")}>
          <SkipForwardIcon aria-hidden="true" />
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {getErrorStatus(error) === 403
            ? "Spotify didn't allow that. Controls need Spotify Premium and an active device; sign out and back in if you haven't granted playback control yet."
            : "Spotify couldn't do that right now. Try again."}
        </p>
      )}
    </div>
  );
}