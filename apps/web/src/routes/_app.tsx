import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";

/** Pathless layout guarding every signed-in screen. Procedures enforce auth too. */
export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(
      context.orpc.auth.session.queryOptions(),
    );
    if (!session) {
      throw redirect({ to: "/" });
    }
    return { session };
  },
  component: AppLayout,
});

function AppLayout() {
  const { session } = Route.useRouteContext();
  return (
    <AppShell user={session}>
      <Outlet />
    </AppShell>
  );
}
