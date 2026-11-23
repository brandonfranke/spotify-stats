import { createFileRoute } from "@tanstack/react-router";

import { handleToken } from "@/server/spotify-auth";

export const Route = createFileRoute("/auth/token")({
  server: { handlers: { POST: ({ request }) => handleToken(request) } },
});