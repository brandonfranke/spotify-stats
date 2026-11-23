import { createFileRoute } from "@tanstack/react-router";

import { handleLogin } from "@/server/spotify-auth";

export const Route = createFileRoute("/auth/login")({
  server: { handlers: { GET: () => handleLogin() } },
});
