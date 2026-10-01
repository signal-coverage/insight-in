"use client";

import { NavbarBreadcrumbs } from "./components/NavbarBreadcrumbs";
import { ROOT_CLASS_NAME } from "./styles";

export function Navbar() {
  return (
    <header className={ROOT_CLASS_NAME}>
      <NavbarBreadcrumbs />
    </header>
  );
}
