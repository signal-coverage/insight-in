import { auth } from "@clerk/nextjs/server";

// Resource-level session check for Server Components (pages, layouts). The proxy only attaches the
// session; it no longer gates routes, so every protected page and layout calls this itself.
// A signed-out visitor is redirected to sign-in (keeping `redirect_url`), so this never returns
// without a user id.
export const requireUserId = async (): Promise<string> => {
  const { userId, redirectToSignIn } = await auth();

  if (userId) {
    return userId;
  }

  // Throws Next's redirect error, so nothing below runs for a signed-out visitor.
  redirectToSignIn();

  throw new Error("Unauthenticated request reached a protected resource.");
};
