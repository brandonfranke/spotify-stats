import type { Image } from "@spotify/web-api-ts-sdk";

export const TIME_RANGES = [
  { value: "short_term", label: "About 4 weeks" },
  { value: "medium_term", label: "About 6 months" },
  { value: "long_term", label: "About 1 year" },
] as const;

export type TimeRange = (typeof TIME_RANGES)[number]["value"];

export function timeRangeLabel(range: TimeRange) {
  return TIME_RANGES.find((item) => item.value === range)?.label ?? "About 6 months";
}

export function formatDuration(ms: number | null | undefined) {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
}

/** Formats a release date only to the precision Spotify supplied. */
export function formatReleaseDate(
  date: string | null | undefined,
  precision: string | null | undefined,
) {
  if (!date) return "Unknown";
  const [year, month, day] = date.split("-").map(Number);
  if (precision === "year" || !month) return String(year);
  const value = new Date(Date.UTC(year!, month - 1, day || 1));
  return value.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    ...(precision === "month" || !day ? {} : { day: "numeric" }),
    timeZone: "UTC",
  });
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}

/** Smallest image at least `minSize` wide, falling back to the largest available. */
export function pickImage(images: Image[] | null | undefined, minSize = 64) {
  if (!images?.length) return null;
  const sorted = [...images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  return sorted.find((image) => (image.width ?? Infinity) >= minSize) ?? sorted.at(-1)!;
}

export function plural(value: number, noun: string) {
  return `${value.toLocaleString("en-US")} ${noun}${value === 1 ? "" : "s"}`;
}

export function humanize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}
