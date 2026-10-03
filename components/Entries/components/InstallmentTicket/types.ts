import type { TicketLine } from "@/components/Entries/types";

export interface InstallmentTicketProps {
  // The small spaced-out title on top ("COMPRA EN CUOTAS", "DEVOLUCIÓN EN CUOTAS").
  brand: string;
  // The heading the ticket is named after ("Resumen de la compra").
  heading: string;
  lines: readonly TicketLine[];
}
