import { createORPCClient, ORPCError } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createRouterClient } from "@orpc/server";
import type { RouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { appRouter } from "@spotify-stats/api/routers/index";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { createContext } from "../context";

export function getErrorStatus(error: unknown): number | null {
  return error instanceof ORPCError ? error.status : null;
}

export function shouldRetry(failureCount: number, error: unknown) {
  const status = getErrorStatus(error);
  // Never retry auth, permission, not-found, validation or quota failures.
  if (status !== null && status >= 400 && status < 500) return false;
  return failureCount < 1;
}

export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        // Sessions can end mid-visit (expiry, disconnect elsewhere). Send the
        // browser back to sign-in; other errors are shown per section.
        if (typeof window !== "undefined" && getErrorStatus(error) === 401) {
          window.location.assign("/");
        }
      },
    }),
    defaultOptions: {
      queries: { staleTime: 60 * 1000, retry: shouldRetry, refetchOnWindowFocus: false },
    },
  });
}

const getORPCClient = createIsomorphicFn()
  .server(() =>
    createRouterClient(appRouter, {
      context: async () => {
        return createContext({ req: getRequest() });
      },
    }),
  )
  .client((): RouterClient<typeof appRouter> => {
    const link = new RPCLink({
      url: `${window.location.origin}/api/rpc`,
    });

    return createORPCClient(link);
  });

export const client: RouterClient<typeof appRouter> = getORPCClient();

export const orpc = createTanstackQueryUtils(client);
