import { SignInButton } from "@clerk/nextjs";

import { SignInTrigger } from "./components/SignInTrigger";
import type { SidebarSignInProps } from "./types";

// Clerk's SignInButton clones its single child and injects `onClick`, so the child must be the
// component that turns that click into a press on the HeroUI button.
export function SidebarSignIn({ isCollapsed }: SidebarSignInProps) {
  return (
    <SignInButton>
      <SignInTrigger isCollapsed={isCollapsed} />
    </SignInButton>
  );
}
