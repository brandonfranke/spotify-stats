import type { Context as ApiContext, Session } from "@spotify-stats/api/context";

import { ENV } from "./env.server";
import { getSession } from "./server/spotify-auth";

// SSR creates a context per procedure call; share one session lookup per request.
const sessions = new WeakMap<Request, Promise<Session | null>>();

export async function createContext({ req }: { req: Request }): Promise<ApiContext> {
  return {
    getSession: () => {
      let session = sessions.get(req);
      if (!session) {
        session = getSession();
        sessions.set(req, session);
        // Let a failed lookup be retried within the same request.
        session.catch(() => sessions.delete(req));
      }
      return session;
    },
    features: { sound: ENV.SOUND_LOOKUPS !== false },
  };
}