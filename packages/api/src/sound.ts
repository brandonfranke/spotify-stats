import { fetchJson, finite, webUrl } from "./fetch-json";

/**
 * Audio features from outside Spotify, which closed its own audio-features API to new apps.
 * ReccoBeats covers most tracks by Spotify ID; Deezer (by ISRC) fills in BPM when it doesn't.
 */

export type Sound = {
  /** Where the values came from, for attribution. */
  sources: { name: string; url: string }[];
  /** Beats per minute. */
  tempo: number | null;
  /** Pitch class (0 = C … 11 = B); null when unknown. */
  key: number | null;
  /** 1 = major, 0 = minor. */
  mode: number | null;
  /** Average loudness in dB. */
  loudness: number | null;
  /** 0–1 descriptors; empty when the source doesn't provide them. */
  traits: Partial<Record<(typeof TRAITS)[number], number>>;
};

export const TRAITS = [
  "energy",
  "danceability",
  "valence",
  "acousticness",
  "instrumentalness",
  "speechiness",
  "liveness",
] as const;

async function fromReccoBeats(id: string): Promise<Sound | null> {
  const body = (await fetchJson(`https://api.reccobeats.com/v1/audio-features?ids=${id}`)) as {
    content?: unknown;
  } | null;
  const content = Array.isArray(body?.content) ? (body.content as Record<string, unknown>[]) : [];
  const features = content.find((item) => typeof item?.href === "string" && item.href.endsWith(`/track/${id}`));
  if (!features) return null;
  const key = finite(features.key);
  const mode = finite(features.mode);
  return {
    sources: [{ name: "ReccoBeats", url: "https://reccobeats.com" }],
    tempo: finite(features.tempo) || null,
    key: key != null && Number.isInteger(key) && key >= 0 && key <= 11 ? key : null,
    mode: mode === 0 || mode === 1 ? mode : null,
    loudness: finite(features.loudness),
    traits: Object.fromEntries(
      TRAITS.flatMap((trait) => {
        const value = finite(features[trait]);
        return value == null || value < 0 || value > 1 ? [] : [[trait, value]];
      }),
    ),
  };
}

/** Deezer only knows BPM. Its `gain` is a playback normalization value, not loudness, so it's ignored. */
async function fromDeezer(isrc: string): Promise<Sound | null> {
  const body = (await fetchJson(`https://api.deezer.com/track/isrc:${isrc}`)) as {
    bpm?: unknown;
    link?: unknown;
  } | null;
  // Deezer reports 0 when it hasn't analyzed the track (and an `error` object when it doesn't have it).
  const tempo = finite(body?.bpm) || null;
  if (!tempo) return null;
  return {
    sources: [{ name: "Deezer", url: webUrl(body?.link) ?? "https://www.deezer.com" }],
    tempo,
    key: null,
    mode: null,
    loudness: null,
    traits: {},
  };
}
/** Sound data for one track, or null when no source knows it. */
export async function getSound(id: string, isrc?: string): Promise<Sound | null> {
  const recco = await fromReccoBeats(id);
  if (recco?.tempo || !isrc) return recco;
  const deezer = await fromDeezer(isrc);
  if (!deezer) return recco;
  return recco ? { ...recco, tempo: deezer.tempo, sources: [...recco.sources, ...deezer.sources] } : deezer;
}