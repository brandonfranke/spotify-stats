// @vitest-environment jsdom
import type { Sound } from "@spotify-stats/api/sound";
import { getSound } from "@spotify-stats/api/sound";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SoundReadout } from "@/components/sound";
import { formatKey } from "@/lib/format";

const ID = "3n3Ppam7vgaVa1iaRUc9Lp";
const ISRC = "GBFFP0300052";

function stubFetch(routes: Record<string, unknown>) {
  const fetch = vi.fn(async (url: string) => {
    const match = Object.keys(routes).find((prefix) => url.startsWith(prefix));
    return match ? Response.json(routes[match]) : new Response(null, { status: 404 });
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => vi.unstubAllGlobals());

describe("getSound", () => {
  it("uses ReccoBeats when it has the track and skips Deezer", async () => {
    const fetch = stubFetch({
      "https://api.reccobeats.com": {
        content: [{ href: `https://open.spotify.com/track/${ID}`, tempo: 148.1, key: 1, mode: 1, energy: 0.9, loudness: -4.4 }],
      },
    });
    const sound = await getSound(ID, ISRC);
    expect(sound).toMatchObject({ tempo: 148.1, key: 1, mode: 1, loudness: -4.4, traits: { energy: 0.9 } });
    expect(sound?.sources.map((s) => s.name)).toEqual(["ReccoBeats"]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("falls back to Deezer's BPM by ISRC", async () => {
    stubFetch({
      "https://api.reccobeats.com": { content: [] },
      "https://api.deezer.com": { bpm: 120.5, gain: -7, link: "https://www.deezer.com/track/1" },
    });
    const sound = await getSound(ID, ISRC);
    // Deezer's gain is a normalization value, not loudness.
    expect(sound).toMatchObject({ tempo: 120.5, key: null, loudness: null, sources: [{ name: "Deezer" }] });
  });

  it("returns null when no source knows the track (Deezer reports bpm 0)", async () => {
    stubFetch({ "https://api.reccobeats.com": { content: [] }, "https://api.deezer.com": { bpm: 0 } });
    expect(await getSound(ID, ISRC)).toBeNull();
  });

  it("ignores malformed ReccoBeats data instead of crashing", async () => {
    stubFetch({ "https://api.reccobeats.com": { content: {} }, "https://api.deezer.com": { bpm: 99 } });
    expect(await getSound(ID, ISRC)).toMatchObject({ tempo: 99 });
  });

  it("throws a retryable error when a service is down, rather than reporting no data", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 503 })));
    await expect(getSound(ID, ISRC)).rejects.toMatchObject({ code: "BAD_GATEWAY" });
  });
});

describe("SoundReadout", () => {
  it("shows tempo, key and trait meters with attribution", () => {
    const sound: Sound = {
      sources: [{ name: "ReccoBeats", url: "https://reccobeats.com" }],
      tempo: 148.1,
      key: 1,
      mode: 1,
      loudness: -4.36,
      traits: { energy: 0.918 },
    };
    render(<SoundReadout sound={sound} />);
    expect(screen.getByText("148")).toBeTruthy();
    expect(screen.getByText("C♯ major")).toBeTruthy();
    expect(screen.getByRole("meter", { name: "energy" }).getAttribute("aria-valuenow")).toBe("92");
    expect(screen.getByRole("link", { name: "ReccoBeats" })).toBeTruthy();
  });

  it("explains when nothing is available", () => {
    render(<SoundReadout sound={null} />);
    expect(screen.getByText(/has sound data for this track/)).toBeTruthy();
  });
});

describe("formatKey", () => {
  it("names the pitch and mode, and ignores unknown keys", () => {
    expect(formatKey(9, 0)).toBe("A minor");
    expect(formatKey(-1, 1)).toBeNull();
  });
});