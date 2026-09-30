import {
  CalendarDaysIcon,
  CreditCardIcon,
  DocumentTextIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";

import type { NavItem } from "./types";

export const NAV_ITEMS: readonly NavItem[] = [
  {
    label: "Overview",
    href: "/dashboard/overview",
    icon: Squares2X2Icon,
    children: [
      { label: "Project", href: "/dashboard/overview/project", icon: Squares2X2Icon },
      { label: "Revenue", href: "/dashboard/overview/revenue", icon: Squares2X2Icon },
      { label: "Insights", href: "/dashboard/overview/insights", icon: Squares2X2Icon },
    ],
  },
  { label: "Billing", href: "/dashboard/billing", icon: CreditCardIcon },
  { label: "Calendar", href: "/dashboard/calendar", icon: CalendarDaysIcon },
  { label: "Invoices", href: "/dashboard/invoices", icon: DocumentTextIcon },
];
