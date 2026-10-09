import type { BanksActionResult } from "@/core/banks/types";

export interface ConfirmDeleteDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  // Called once the delete went through: the thing is gone, so whatever showed it closes too.
  onDeleted: () => void;
  // The question, naming what is about to go: "¿Eliminar la cuenta Caja de ahorro?".
  heading: string;
  // What the user must know before confirming.
  warning: string;
  // The server action of the thing being deleted, with its id already bound. Passed in so this stays
  // free of server code.
  onConfirm: () => Promise<BanksActionResult>;
}

export type ConfirmDeleteContentProps = Omit<
  ConfirmDeleteDialogProps,
  "isOpen" | "onOpenChange"
>;
