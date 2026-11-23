import { ORPCError, os } from "@orpc/server";

import type { Context } from "./context";

export const o = os.$context<Context>();

export const publicProcedure = o;

/**
 * Requires a valid Spotify-backed session. Applies to every caller, including
 * the server-side router client used during SSR.
 */
export const protectedProcedure = publicProcedure.use(({ context, next }) => {
  if (!context.session || !context.spotify) {
    throw new ORPCError("UNAUTHORIZED", { message: "Sign in with Spotify to continue." });
  }
  return next({ context: { session: context.session, spotify: context.spotify } });
});
