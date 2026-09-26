"use client";

import { NavbarAccount } from "./components/NavbarAccount";
import { NavbarBreadcrumbs } from "./components/NavbarBreadcrumbs";
import { NavbarToggle } from "./components/NavbarToggle";
import { ROOT_CLASS_NAME } from "./styles";

export function Navbar() {
  return (
    <header className={ROOT_CLASS_NAME}>
      <NavbarToggle />
      <NavbarBreadcrumbs />
      <NavbarAccount />
    </header>
  );
}
