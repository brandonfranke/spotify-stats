import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

/** Renders UI inside a minimal memory router so <Link> works in tests. */
export async function renderWithRouter(ui: ReactNode) {
  const rootRoute = createRootRoute();
  const paths = ["/", "/tracks/$id", "/artists/$id", "/albums/$id", "/playlists/$id", "/privacy"];
  const routes = paths.map((path) =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => <>{ui}</> }),
  );
  const router = createRouter({
    routeTree: rootRoute.addChildren(routes),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router as never} />
    </QueryClientProvider>,
  );
  await screen.findByTestId("rendered");
  return { ...result, router };
}

export function Rendered({ children }: { children: ReactNode }) {
  return <div data-testid="rendered">{children}</div>;
}
