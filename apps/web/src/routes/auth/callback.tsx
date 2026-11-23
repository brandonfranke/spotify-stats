import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import { getLoginConfig, login } from "@/lib/login";

export const Route = createFileRoute("/auth/callback")({
  loader: () => getLoginConfig(),
  component: Callback,
});

// The SDK's code verifier is single-use, so sign in once per page load even if the effect re-runs.
let signingIn: Promise<string | null> | undefined;

function Callback() {
  const config = Route.useLoaderData();
  useEffect(() => {
    // Spotify sends ?error when the user denies access; without a code the SDK would redirect again.
    const denied = new URLSearchParams(window.location.search).has("error");
    signingIn ??= denied ? Promise.resolve("denied") : login(config);
    void signingIn.then((error) => window.location.assign(error ? `/?error=${error}` : "/overview"));
  }, [config]);
  return <p className="paper grid min-h-svh place-items-center text-muted-foreground">Signing you in…</p>;
}