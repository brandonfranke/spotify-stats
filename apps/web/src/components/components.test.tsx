// @vitest-environment jsdom
import { ORPCError } from "@orpc/client";
import type { Track } from "@spotify/web-api-ts-sdk";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Rendered, renderWithRouter } from "@/test/render";

import { ErrorNotice, QueryView } from "./editorial";
import { MusicList, TrackRow } from "./music";
import { TimeRangeTabs } from "./time-range-tabs";

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
