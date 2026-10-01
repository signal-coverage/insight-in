// An address is active on itself and on everything under it, unless it must match exactly.
export const isActivePath = (
  pathname: string,
  href: string,
  exact = false,
): boolean => pathname === href || (!exact && pathname.startsWith(`${href}/`));
