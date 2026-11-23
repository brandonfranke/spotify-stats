import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { appRouter } from "@spotify-stats/api/routers/index";
import { createFileRoute } from "@tanstack/react-router";

import { createContext } from "../../../context";

/** Logs only the error class/code; never request data, tokens, or Spotify content. */
function logError(error: unknown) {
  if (error instanceof ORPCError) {
    if (error.status >= 500) console.error(`[rpc] ${error.code} (${error.status})`);
    return;
  }
  const name = error instanceof Error ? error.name : typeof error;
  console.error(`[rpc] unhandled ${name}`);
}

const rpcHandler = new RPCHandler(appRouter, { interceptors: [onError(logError)] });

// The interactive OpenAPI reference is a development convenience only.
const apiHandler = import.meta.env.PROD
  ? null
  : new OpenAPIHandler(appRouter, {
      plugins: [new OpenAPIReferencePlugin({ schemaConverters: [new ZodToJsonSchemaConverter()] })],
      interceptors: [onError(logError)],
    });

async function handle({ request }: { request: Request }) {
  const context = await createContext({ req: request });

  const rpcResult = await rpcHandler.handle(request, { prefix: "/api/rpc", context });
  if (rpcResult.response) return rpcResult.response;

  if (apiHandler) {
    const apiResult = await apiHandler.handle(request, {
      prefix: "/api/rpc/api-reference",
      context,
    });
    if (apiResult.response) return apiResult.response;
  }

  return new Response("Not found", { status: 404 });
}

export const Route = createFileRoute("/api/rpc/$")({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
    },
  },
});
