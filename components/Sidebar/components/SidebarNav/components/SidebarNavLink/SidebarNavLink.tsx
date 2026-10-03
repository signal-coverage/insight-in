import { Link } from "@heroui/react";
import NextLink from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils/utils";

import { ROOT_CLASS_NAME } from "./styles";
import type { SidebarNavLinkProps } from "./types";

// HeroUI's Link for the look and the press/focus behaviour, next/link for the navigation (client
// transitions and prefetching). Without a RouterProvider the HeroUI link leaves the click alone,
// so next/link handles it.
export function SidebarNavLink({
  href,
  isActive = false,
  className,
  children,
}: SidebarNavLinkProps) {
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(ROOT_CLASS_NAME, className)}
      // With an href the HeroUI link always renders an anchor; its render props are typed
      // anchor-or-span.
      render={(props) => (
        <NextLink {...(props as ComponentProps<"a">)} href={href} />
      )}
    >
      {children}
    </Link>
  );
}
