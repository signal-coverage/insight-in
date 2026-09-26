"use client";

import { Breadcrumbs, RouterProvider } from "@heroui/react";
import { usePathname, useRouter } from "next/navigation";

import { buildCrumbs } from "./utils";

export function NavbarBreadcrumbs() {
  const pathname = usePathname();
  const router = useRouter();
  const crumbs = buildCrumbs(pathname);

  return (
    <RouterProvider navigate={(href) => router.push(href)}>
      <Breadcrumbs>
        {crumbs.map((crumb) => (
          <Breadcrumbs.Item key={crumb.href ?? "current"} href={crumb.href}>
            {crumb.label}
          </Breadcrumbs.Item>
        ))}
      </Breadcrumbs>
    </RouterProvider>
  );
}
