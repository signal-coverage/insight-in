// What a bulk delete action answers: how many were deleted and, when the entity can leave some out
// (a card with a purchase still pending), how many were left out.
export type BulkDeleteOutcome =
  | { status: "success"; deleted: number; skipped?: number }
  | { status: "error"; message: string };

export interface BulkDeleteCopy {
  // The question: "¿Eliminar 3 gastos?", with the right noun and number.
  heading: (count: number) => string;
  // Says what became of the rest when some were left out. Only entities that can leave some out
  // need it.
  partialResult?: (deleted: number, skipped: number) => string;
}

export interface BulkDeleteDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  // The ids to delete, as they were when the dialog opened: the selection may change meanwhile.
  ids: readonly string[];
  copy: BulkDeleteCopy;
  // The server action of the entity, passed in so this stays free of server code.
  action: (ids: string[]) => Promise<BulkDeleteOutcome>;
  // Called, before the action is awaited, with the ids about to go: the table shows them as such
  // until the refreshed rows arrive.
  onDeleting: (ids: readonly string[]) => void;
  // Called once something was actually deleted (the selection no longer holds those rows).
  onDeleted: () => void;
}

export type BulkDeleteContentProps = Omit<
  BulkDeleteDialogProps,
  "isOpen" | "onOpenChange"
>;
