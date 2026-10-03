import {
  BanknotesIcon,
  CalendarDaysIcon,
  CreditCardIcon,
  DocumentTextIcon,
  ReceiptPercentIcon,
  Squares2X2Icon,
  ViewColumnsIcon,
} from "@heroicons/react/24/outline";

import type { NavItem } from "./types";

export const NAV_ITEMS: readonly NavItem[] = [
  {
    label: "Resumen",
    href: "/dashboard/overview",
    icon: Squares2X2Icon,
    children: [
      {
        label: "General",
        href: "/dashboard/overview",
        icon: Squares2X2Icon,
        exact: true,
      },
      {
        label: "Proyecto",
        href: "/dashboard/overview/project",
        icon: Squares2X2Icon,
      },
      {
        label: "Facturación",
        href: "/dashboard/overview/revenue",
        icon: Squares2X2Icon,
      },
      {
        label: "Conversiones",
        href: "/dashboard/overview/insights",
        icon: Squares2X2Icon,
      },
    ],
  },
  { label: "Ingresos", href: "/dashboard/incomes", icon: BanknotesIcon },
  { label: "Gastos", href: "/dashboard/expenses", icon: ReceiptPercentIcon },
  { label: "Tarjetas", href: "/dashboard/cards", icon: CreditCardIcon },
  { label: "Hoja de ruta", href: "/dashboard/roadmap", icon: ViewColumnsIcon },
  { label: "Cobros", href: "/dashboard/billing", icon: CreditCardIcon },
  { label: "Calendario", href: "/dashboard/calendar", icon: CalendarDaysIcon },
  { label: "Facturas", href: "/dashboard/invoices", icon: DocumentTextIcon },
];
