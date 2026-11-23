import type { RouterClient } from "@orpc/server";

import type { SessionPrincipal } from "../context";
import { publicProcedure } from "../index";
import { spotifyRouter } from "./spotify";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
  auth: {
    /** Sanitized signed-in state for navigation. Never includes token material. */
    session: publicProcedure.handler(({ context }): SessionPrincipal | null => context.session),
  },
  spotify: spotifyRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
