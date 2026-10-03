import { clerkMiddleware } from "@clerk/nextjs/server";

// The proxy only attaches the Clerk session to each request so `auth()` works everywhere.
// Route protection lives in the resources themselves: every page and layout under
// app/dashboard calls `requireUserId()` (lib/auth/requireUserId.ts) and Server Actions go
// through `runAuthenticated` (core/incomes/actions.ts).
export default clerkMiddleware({ signInUrl: "/" });

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
