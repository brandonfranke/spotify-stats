import { ORPCError } from "@orpc/server";

/**
 * GET a third-party JSON API. Returns null when the resource doesn't exist (4xx) and throws
 * BAD_GATEWAY when the service is unreachable, slow, rate-limited or broken, so callers can
 * tell "not found" from "try again".
 */
export async function fetchJson(url: string | URL, headers: Record<string, string> = {}): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: "application/json", ...headers }, signal: AbortSignal.timeout(5000) });
  } catch (cause) {
    throw new ORPCError("BAD_GATEWAY", { cause });
  }
  if (response.status === 429 || response.status >= 500) throw new ORPCError("BAD_GATEWAY");
  if (!response.ok) return null;
  try {
    return await response.json();
  } catch (cause) {
    throw new ORPCError("BAD_GATEWAY", { cause });
  }
}

/** A finite number, or null. */
export const finite = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** An http(s) URL, or null, so third-party links are safe to render. */
export function webUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}