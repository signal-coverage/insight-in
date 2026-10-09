import {
  ArrowPathIcon,
  ArrowsRightLeftIcon,
  ArrowUturnLeftIcon,
  CreditCardIcon,
  LinkIcon,
  ReceiptRefundIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";

import type { MarkerDefinition } from "./types";

// Every icon that stands for something next to a value in the tables, with the words it says (its
// accessible name and its tooltip). The tables draw their markers from here, and so does the help
// page: that is what keeps what the app shows and what the help explains from drifting apart.
export const MARKERS = {
  installment: { icon: CreditCardIcon, label: "Compra en cuotas" },
  recurring: { icon: ArrowPathIcon, label: "Recurrente" },
  // An installment of a loan repaid to the user: a returning arrow, not the credit card of the
  // purchases in installments.
  repayment: { icon: ArrowUturnLeftIcon, label: "Devolución en cuotas" },
  // An expense that is expected to be paid back (a health-insurance refund, a loan to a friend). Its
  // tooltip says how much is still owed, so only the name is shared.
  reimbursement: { icon: ReceiptRefundIcon, label: "Reintegro esperado" },
  // An income that pays an expense back: linked to it. Its tooltip names that expense.
  reimburses: { icon: LinkIcon, label: "Devolución de un gasto" },
  // Someone else paid it: it stands in for the status checkbox.
  covered: { icon: UserGroupIcon, label: "Cubierta por otro" },
} as const satisfies Record<string, MarkerDefinition>;

// The marker of an amount that was quoted in (or came from) another currency. Its words change with
// the row ("Se cotizó en 20 USD"), so only the icon is shared.
export const ORIGIN_MARKER_ICON = ArrowsRightLeftIcon;
