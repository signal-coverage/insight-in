import {
  ArrowsRightLeftIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
  CreditCardIcon,
  ReceiptPercentIcon,
  Squares2X2Icon,
  ViewColumnsIcon,
} from "@heroicons/react/24/outline";

import type { NavSection } from "./types";

export const NAV_SECTIONS: readonly NavSection[] = [
  {
    label: "Principal",
    items: [
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
            label: "Conversiones",
            href: "/dashboard/overview/insights",
            icon: Squares2X2Icon,
          },
        ],
      },
    ],
  },
  {
    label: "Movimientos",
    items: [
      { label: "Ingresos", href: "/dashboard/incomes", icon: BanknotesIcon },
      {
        label: "Gastos",
        href: "/dashboard/expenses",
        icon: ReceiptPercentIcon,
      },
      {
        label: "Transferencias",
        href: "/dashboard/transfers",
        icon: ArrowsRightLeftIcon,
      },
    ],
  },
  {
    label: "Cuentas",
    items: [
      { label: "Bancos", href: "/dashboard/banks", icon: BuildingLibraryIcon },
      { label: "Tarjetas", href: "/dashboard/cards", icon: CreditCardIcon },
    ],
  },
  {
    label: null,
    items: [
      {
        label: "Hoja de ruta",
        href: "/dashboard/roadmap",
        icon: ViewColumnsIcon,
      },
    ],
  },
];
