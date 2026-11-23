# Repository instructions

## Priorities

Prefer clean, simple, easy-to-read code over clever or convoluted solutions.
Choose the smallest correct implementation that another contributor can understand
without reconstructing layers of indirection.

- Use descriptive names, straightforward control flow, and small, cohesive functions.
- Reuse existing helpers and components before introducing new ones. Extract an
  abstraction when it removes meaningful duplication, not for hypothetical reuse.
- Avoid premature optimization, unnecessary wrappers, deeply nested conditionals,
  and dense one-liners. Optimize only when there is a demonstrated need.
- Keep changes focused on the request. Preserve existing behavior and unrelated
  worktree changes; do not opportunistically rewrite surrounding code.
- Follow the surrounding formatting and import conventions. Comment only to
  explain non-obvious decisions or constraints, not what the code already says.
- Preserve strict TypeScript types. Prefer inference, SDK types, and runtime
  validation over `any`, non-null assertions, or casts that hide a mismatch.
- Surface failures explicitly using the existing error and UI patterns. Do not
  turn errors into empty data or successful-looking results.

## Project and stack

Spotify Stats is a self-hosted Spotify companion for top tracks and artists,
recent plays, library browsing, search, detail pages, and playback controls.
Spotify is the login provider; playback controls require Spotify Premium.

This is a TypeScript/ES module monorepo with Bun workspaces and Turborepo.
Use Bun for dependencies and scripts, keep `bun.lock` consistent with dependency
changes, and reuse the root workspace catalog for shared dependencies.

| Area | Libraries and tools |
| --- | --- |
| Web app | React, TanStack Start and Router, Vite, Nitro's Node server preset |
| Data fetching | TanStack Query, oRPC, `@orpc/tanstack-query` |
| API | oRPC procedures, Zod input validation, official `@spotify/web-api-ts-sdk` |
| UI | Tailwind CSS v4, shared shadcn/ui components built on Base UI, Lucide icons, Sonner toasts, next-themes |
| Environment | Varlock schema validation and generated TypeScript environment types |
| Tests | Vitest, React Testing Library, user-event, jsdom for component tests |
| Deployment | Docker/Compose; Bun builds the app and Node runs the production output |

Consult the package manifests for exact dependency versions and available scripts.

## Repository map

| Path | Responsibility |
| --- | --- |
| `apps\web\src\routes` | File-based pages and server endpoints; `_app.tsx` is the protected pathless layout |
| `apps\web\src\components` | App-specific shell, music presentation, query states, and pagination |
| `apps\web\src\lib` | Browser login and display-formatting helpers |
| `apps\web\src\server` | Server-side Spotify authentication and its tests |
| `apps\web\src\context.ts` | Host app's per-request API context |
| `apps\web\src\utils\orpc.ts` | Typed clients, query utilities, cache configuration, and retry behavior |
| `apps\web\src\router.tsx` | Router setup and SSR/query integration |
| `apps\web\src\test` | Shared test setup and router-aware render helpers |
| `apps\web\.env.schema` | Environment variable definitions, validation, and public/runtime annotations |
| `packages\api\src\routers` | API router composition and Spotify procedures |
| `packages\api\src\index.ts` | Public and protected procedure foundations |
| `packages\api\src\spotify.ts` | Spotify SDK construction, response handling, and error translation |
| `packages\ui\src` | Shared UI primitives, hooks, utilities, and design tokens |
| `packages\config` | Shared TypeScript configuration |

Read current source and callers before editing. The app stores nothing server-side:
the session (Spotify token + basic profile) lives in one HttpOnly cookie.

## Implementation conventions

- Use `@/` for web source imports and `@spotify-stats/*` package exports for shared
  code. Keep app-specific code in the web app and reusable primitives in the UI package.
- Follow existing file-route patterns. Validate URL search state with Zod and keep
  pagination, filters, and time ranges in route search parameters where appropriate.
- Fetch app data through the typed `orpc` query/mutation utilities. SSR uses a
  server-side router client; browser requests use `/api/rpc`. Both must enforce auth.
- Pass oRPC `queryOptions` directly to `useQuery`; do not spread them into a new
  object. Put additional options such as `enabled` inside `queryOptions`:
  `useQuery(orpc.spotify.top.tracks.queryOptions({ input, enabled }))`.
- Use `protectedProcedure` for private API operations; the `_app` route guard is
  not a substitute for server-side authorization. Validate procedure inputs with Zod.
- Prefer the official Spotify SDK and its types. Keep compatibility workarounds
  narrow and near the SDK boundary, and explain the upstream limitation.
- Respect Spotify pagination, rate limits, unavailable endpoints, and nullable
  playback/playlist data. Do not present Spotify rankings as actual play counts.
  Display what Spotify supplies; don't compute derived listening metrics (Developer
  Policy III.13).
- Reuse `QueryView`, `ErrorNotice`, `Pager`, and music components for consistent
  loading, error, empty, and populated states. Use shared UI primitives and theme
  tokens rather than bespoke substitutes; preserve keyboard access and labels.
- Keep tokens and private configuration on the server. Preserve
  same-origin auth checks and HttpOnly cookie protections; never log credentials.
- Define environment changes in `.env.schema` and run code generation rather than
  manually editing `src\env.ts`. Deployment variables marked dynamic must remain
  runtime values, not be frozen into client bundles or builds.
- Do not manually edit generated route trees, build output, dependency folders,
  or TypeScript build artifacts.

## Commands and validation

Run commands from the repository root unless noted otherwise.

| Command | Purpose |
| --- | --- |
| `bun install` | Install workspace dependencies |
| `bun run dev` | Start development tasks; web runs at `http://127.0.0.1:3001` |
| `bun run build` | Build the workspaces; web production output is `apps\web\.output` |
| `bun run check-types` | Check workspace types; the web check also performs a Vite build |
| `bun run test` | Run tests through Turborepo |
| `bun run env:generate` | Regenerate Varlock environment types |
| `bun run --cwd apps\web test src\components\components.test.tsx` | Example focused test run |

Use the smallest existing validation command that covers the change. Add focused
regression tests for new or fixed behavior, using the existing test helpers.
Vitest defaults to Node; component tests opt into jsdom with a file annotation.
Run type checks for TypeScript changes and a production build for changes affecting
bundling, SSR, environment loading, or deployment. Documentation-only changes do
not require app tests.

There is currently no runnable lint/format script in the package manifests;
Turborepo's `lint` task declaration alone does not provide one. Do not invent
commands or introduce tooling just for a routine change. Report checks actually
run and distinguish pre-existing failures from failures introduced by the change.

For local Spotify login, configure `apps\web\.env` and register
`http://127.0.0.1:3001/auth/callback`; Spotify does not accept `localhost` redirect
URIs. Never commit local environment values or generated database files.
