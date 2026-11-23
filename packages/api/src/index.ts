import { ORPCError, os } from "@orpc/server";

import type { Context } from "./context";

export const o = os.$context<Context>();

export const publicProcedure = o;

/**
 * Requires a valid Spotify-backed session. Applies to every caller, including
 * the server-side router client used during SSR.
 */
export const protectedProcedure = publicProcedure.use(async ({ context, next }) => {
  const session = await context.getSession();
  if (!session) {
    throw new ORPCError("UNAUTHORIZED", { message: "Sign in with Spotify to continue." });
  }
  return next({ context: { session: session.user, spotify: session.spotify } });
});
