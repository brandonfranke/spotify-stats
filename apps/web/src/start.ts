import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Content-Security-Policy": "frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  "Cross-Origin-Opener-Policy": "same-origin",
};

/**
 * Applies security headers to every server-handled response, and marks
 * dynamic responses (SSR pages, RPC, auth) as private and uncacheable since
 * they may contain account data. Built static assets are served before this
 * middleware and keep their own caching.
 */
const securityHeaders = createMiddleware().server(async ({ next }) => {
  const result = await next();
  const headers = result.response.headers;
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(name)) headers.set(name, value);
  }
  if (!headers.has("Cache-Control")) headers.set("Cache-Control", "private, no-store");
  return result;
});

export const startInstance = createStart(() => ({
  requestMiddleware: [
    createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === "serverFn" }),
    securityHeaders,
  ],
}));
