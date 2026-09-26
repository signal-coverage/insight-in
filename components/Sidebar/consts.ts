import {
  CalendarDaysIcon,
  CreditCardIcon,
  DocumentTextIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";

import type { NavItem } from "./types";

export const NAV_ITEMS: readonly NavItem[] = [
  { label: "Overview", href: "/overview", icon: Squares2X2Icon },
  { label: "Billing", href: "/billing", icon: CreditCardIcon },
  { label: "Calendar", href: "/calendar", icon: CalendarDaysIcon },
  { label: "Invoices", href: "/invoices", icon: DocumentTextIcon },
];
