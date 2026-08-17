import { clerkMiddleware } from "@clerk/nextjs/server";

// Auth gating happens per-page/route via resource-based checks (see
// getOrCreateUser()/auth() calls in (app)/layout.tsx and every /api route)
// rather than here. clerkMiddleware() still needs to run on every request so
// Clerk can attach session context, but calling auth.protect() here caused a
// genuine bug: on this dev-instance Clerk key, protect() can trigger an
// internal rewrite to establish the cross-domain "dev browser" handshake
// before the corresponding cookie exists, and that rewritten request doesn't
// match any real Next.js route — producing a hard 404 instead of the
// intended sign-in redirect. Clerk's own deprecation notice on
// createRouteMatcher recommends exactly this move away from middleware path
// matching.
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
