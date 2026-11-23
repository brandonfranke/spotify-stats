// @vitest-environment jsdom
import { ORPCError } from "@orpc/client";
import type { Track } from "@spotify/web-api-ts-sdk";
import { QueryClient } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Rendered, renderWithRouter } from "@/test/render";
import { orpc } from "@/utils/orpc";

import { ErrorNotice, QueryView } from "./editorial";
import { MusicList, TrackArtwork, TrackRow } from "./music";
import { TimeRangeTabs } from "./time-range-tabs";

const { playTrack } = vi.hoisted(() => ({ playTrack: vi.fn() }));

vi.mock("@/utils/orpc", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/orpc")>();
  const { createTanstackQueryUtils } = await import("@orpc/tanstack-query");
  return {
    ...actual,
    orpc: createTanstackQueryUtils({ spotify: { player: { play: playTrack } } }),
  };
});

beforeEach(() => {
  playTrack.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

const track = {
  id: "4uLU6hMCjMI75M1A2tKUQC",
  name: "Never Gonna Give You Up",
  duration_ms: 213_573,
  explicit: false,
  artists: [{ id: "0gxyHStUsqpMadRV0Di1Qt", name: "Rick Astley" }],
  album: { id: "6XhjNHCyCDyyGJRM5mg40G", name: "Whenever You Need Somebody", images: [] },
  external_urls: { spotify: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC" },
} as unknown as Track;

describe("TrackRow", () => {
  it("links the track, artist and album to their detail pages", async () => {
    await renderWithRouter(
      <Rendered>
        <MusicList>
          <TrackRow track={track} rank={1} />
        </MusicList>
      </Rendered>,
    );
    expect(screen.getByRole("link", { name: track.name })).toHaveAttribute("href", `/tracks/${track.id}`);
    expect(screen.getByRole("link", { name: "Rick Astley" })).toHaveAttribute(
      "href",
      "/artists/0gxyHStUsqpMadRV0Di1Qt",
    );
    expect(screen.getByRole("link", { name: "Whenever You Need Somebody" })).toHaveAttribute(
      "href",
      "/albums/6XhjNHCyCDyyGJRM5mg40G",
    );
    expect(screen.getByText("3:33")).toBeInTheDocument();
  });

  it("starts the song by keyboard, prevents duplicate requests, and refreshes playback", async () => {
    let finish!: () => void;
    playTrack.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    const invalidate = vi.spyOn(QueryClient.prototype, "invalidateQueries");
    await renderWithRouter(
      <Rendered><MusicList><TrackRow track={track} /></MusicList></Rendered>,
    );
    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: `Play ${track.name}` });
    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(playTrack).toHaveBeenCalledWith({ trackId: track.id }, expect.anything());
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    await user.click(button);
    expect(playTrack).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    await waitFor(() => expect(button).toBeEnabled());
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({
      queryKey: orpc.spotify.player.key(),
    }));
  });

  it.each([
    ["FORBIDDEN", /Spotify Premium/],
    ["NOT_FOUND", /Open Spotify on a device/],
  ] as const)("explains %s playback failures", async (code, message) => {
    playTrack.mockRejectedValue(new ORPCError(code));
    const notify = vi.spyOn(toast, "error");
    await renderWithRouter(
      <Rendered><MusicList><TrackRow track={track} /></MusicList></Rendered>,
    );
    await userEvent.click(screen.getByRole("button", { name: `Play ${track.name}` }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.stringMatching(message)));
    expect(screen.getByRole("button", { name: `Play ${track.name}` })).toBeEnabled();
  });

  it("does not offer song playback for local tracks or tracks without an ID", async () => {
    await renderWithRouter(
      <Rendered>
        <MusicList>
          <TrackRow track={{ ...track, is_local: true }} />
          <TrackRow track={{ ...track, id: "" }} />
        </MusicList>
      </Rendered>,
    );
    expect(screen.queryByRole("button", { name: `Play ${track.name}` })).not.toBeInTheDocument();
  });
});

describe("TrackArtwork", () => {
  it("keeps the cover image intact and plays the displayed song", async () => {
    await renderWithRouter(
      <Rendered>
        <TrackArtwork
          track={track}
          images={[{ url: "https://example.com/cover.jpg", width: 640, height: 640 }]}
          alt="Album cover"
          size={280}
        />
      </Rendered>,
    );
    expect(screen.getByRole("img", { name: "Album cover" })).toHaveAttribute("src", "https://example.com/cover.jpg");
    await userEvent.click(screen.getByRole("button", { name: `Play ${track.name}` }));
    expect(playTrack).toHaveBeenCalledWith({ trackId: track.id }, expect.anything());
  });
});

describe("TimeRangeTabs", () => {
  it("reports the selected affinity window", async () => {
    const onChange = vi.fn();
    render(<TimeRangeTabs value="medium_term" onChange={onChange} />);
    expect(screen.getByRole("tab", { name: "About 6 months" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(screen.getByRole("tab", { name: "About 4 weeks" }));
    expect(onChange).toHaveBeenCalledWith("short_term");
  });
});

describe("QueryView", () => {
  const base = { data: undefined, error: null, isPending: false, refetch: vi.fn() };

  it("shows a skeleton while loading, never placeholder numbers", () => {
    render(<QueryView query={{ ...base, isPending: true }}>{() => "0 plays"}</QueryView>);
    expect(screen.getByLabelText("Loading")).toBeInTheDocument();
    expect(screen.queryByText("0 plays")).not.toBeInTheDocument();
  });

  it("shows the empty message for empty data", () => {
    render(
      <QueryView query={{ ...base, data: [] as string[] }} isEmpty={(d) => d.length === 0} empty="Nothing ranked yet.">
        {() => "content"}
      </QueryView>,
    );
    expect(screen.getByText("Nothing ranked yet.")).toBeInTheDocument();
  });

  it("treats an empty later page as the end of the list, not an empty collection", async () => {
    await renderWithRouter(
      <Rendered>
        <QueryView query={{ ...base, data: [] as string[] }} page={2} isEmpty={(d) => d.length === 0} empty="You haven't saved any tracks.">
          {() => "content"}
        </QueryView>
      </Rendered>,
    );
    expect(screen.queryByText("You haven't saved any tracks.")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to page 1" })).toBeInTheDocument();
  });

  it("shows a retryable error", async () => {
    const refetch = vi.fn();
    render(<QueryView query={{ ...base, error: new Error("boom"), refetch }}>{() => "content"}</QueryView>);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalled();
  });
});

describe("ErrorNotice", () => {
  it("explains rate limiting and offers a retry", () => {
    render(<ErrorNotice error={new ORPCError("TOO_MANY_REQUESTS")} onRetry={() => {}} />);
    expect(screen.getByText("Spotify is rate limiting requests")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("does not offer a retry for permission errors", () => {
    const error = new ORPCError("FORBIDDEN");
    render(<ErrorNotice error={error} onRetry={() => {}} />);
    expect(screen.getByText("Spotify did not allow this request")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
