import type { Features, SessionPrincipal } from "../context";
import { publicProcedure } from "../index";
import { spotifyRouter } from "./spotify";

export const appRouter = {
  auth: {
    /** Sanitized signed-in state for navigation. Never includes token material. */
    session: publicProcedure.handler(
      async ({ context }): Promise<SessionPrincipal | null> => (await context.getSession())?.user ?? null,
    ),
  },
  /** Which optional features are enabled, so the UI can hide the rest. */
  features: publicProcedure.handler(({ context }): Features => context.features),
  spotify: spotifyRouter,
};
