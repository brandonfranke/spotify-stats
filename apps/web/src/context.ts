import type { Context as ApiContext } from "@spotify-stats/api/context";

import { getSession } from "./server/spotify-auth";

export async function createContext(_input: { req: Request }): Promise<ApiContext> {
  const session = await getSession();
  return { session: session?.user ?? null, spotify: session?.spotify ?? null };
}

export type Context = Awaited<ReturnType<typeof createContext>>;