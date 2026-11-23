import { createFileRoute } from "@tanstack/react-router";

import { handleCallback } from "@/server/spotify-auth";

export const Route = createFileRoute("/auth/callback")({
  server: { handlers: { GET: ({ request }) => handleCallback(request) } },
});
