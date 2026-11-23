import { createFileRoute } from "@tanstack/react-router";

import { handleLogout } from "@/server/spotify-auth";

export const Route = createFileRoute("/auth/logout")({
  server: { handlers: { POST: ({ request }) => handleLogout(request) } },
});
