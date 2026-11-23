import { ORPCError } from "@orpc/client";
import { Alert, AlertDescription, AlertTitle } from "@spotify-stats/ui/components/alert";
import { Button } from "@spotify-stats/ui/components/button";
import { Skeleton } from "@spotify-stats/ui/components/skeleton";
import { cn } from "@spotify-stats/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";

/* ---------- Editorial layout ---------- */

export function PageHeader({
  eyebrow,
  title,
  children,
  aside,
}: {
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <header className="rise-in flex flex-col gap-6 border-b border-border pb-8 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-3 font-display text-4xl leading-[1.05] tracking-tight text-balance sm:text-5xl lg:text-6xl">
          {title}
        </h1>
        {children && <div className="mt-4 max-w-2xl text-muted-foreground">{children}</div>}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </header>
  );
}

export function Section({
  number,
  title,
  action,
  children,
  className,
}: {
  number?: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-4", className)} aria-label={title}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="flex items-baseline gap-3 font-display text-2xl tracking-tight">
          {number && <span className="eyebrow tabular font-sans">{number}</span>}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Liner-note style definition list for supplied metadata. */
export function Facts({ items }: { items: [term: string, value: ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-6 border-t border-border text-sm">
      {items.map(([term, value]) => (
        <div key={term} className="contents">
          <dt className="eyebrow border-b border-border py-3">{term}</dt>
          <dd className="tabular border-b border-border py-3 text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ---------- Data states ---------- */

const errorCopy: Record<string, { title: string; body: string }> = {
  FORBIDDEN: {
    title: "Spotify did not allow this request",
    body: "This app may not have access to this item, or your account may not be on the app's allowlist.",
  },
  NOT_FOUND: { title: "Not found", body: "Spotify could not find this item." },
  TOO_MANY_REQUESTS: {
    title: "Spotify is rate limiting requests",
    body: "Too many requests were made, or this app's quota is used up. Wait a moment, then try again.",
  },
};

export function ErrorNotice({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const code = error instanceof ORPCError ? error.code : undefined;
  const copy = (code && errorCopy[code]) || {
    title: "Couldn't load this section",
    body: "Spotify didn't respond as expected. Check your connection and try again.",
  };
  return (
    <Alert variant="destructive" role="alert">
      <AlertTitle>{copy.title}</AlertTitle>
      <AlertDescription>
        <p>{copy.body}</p>
        {onRetry && code !== "FORBIDDEN" && code !== "NOT_FOUND" && (
          <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
            Try again
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="border-y border-dashed border-border py-8 text-center text-muted-foreground">
      {children}
    </p>
  );
}

export function RowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="divide-y divide-border border-y border-border">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex min-h-16 items-center gap-4 py-2">
          <Skeleton className="size-12 rounded-[var(--radius-artwork)]" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

type QueryLike<T> = {
  data: T | undefined;
  error: unknown;
  isPending: boolean;
  refetch: () => unknown;
};

/**
 * Renders loading, error and empty states for a query so each section fails
 * independently. Never shows invented zero values while loading.
 */
export function QueryView<T>({
  query,
  isEmpty,
  empty,
  loading,
  children,
}: {
  query: QueryLike<T>;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  loading?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return <>{loading ?? <RowsSkeleton />}</>;
  if (query.error || query.data === undefined) {
    return <ErrorNotice error={query.error} onRetry={() => query.refetch()} />;
  }
  if (isEmpty?.(query.data)) return <EmptyNote>{empty ?? "Nothing here yet."}</EmptyNote>;
  return <>{children(query.data)}</>;
}

/* ---------- Pagination ---------- */

/** Previous/next pager that keeps page state in the URL search params. */
export function Pager({
  page,
  hasNext,
  label,
}: {
  page: number;
  hasNext: boolean;
  label?: string;
}) {
  if (page <= 1 && !hasNext) return null;
  const linkClass =
    "inline-flex min-h-11 items-center gap-1 px-3 text-sm font-medium hover:bg-accent aria-disabled:pointer-events-none aria-disabled:opacity-40";
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-4">
      <Link
        to="."
        search={(prev: Record<string, unknown>) => ({ ...prev, page: page - 1 })}
        aria-disabled={page <= 1}
        tabIndex={page <= 1 ? -1 : undefined}
        className={linkClass}
      >
        <ChevronLeftIcon className="size-4" aria-hidden="true" /> Previous
      </Link>
      <span className="tabular text-sm text-muted-foreground">
        {label ?? `Page ${page}`}
      </span>
      <Link
        to="."
        search={(prev: Record<string, unknown>) => ({ ...prev, page: page + 1 })}
        aria-disabled={!hasNext}
        tabIndex={!hasNext ? -1 : undefined}
        className={linkClass}
      >
        Next <ChevronRightIcon className="size-4" aria-hidden="true" />
      </Link>
    </nav>
  );
}
