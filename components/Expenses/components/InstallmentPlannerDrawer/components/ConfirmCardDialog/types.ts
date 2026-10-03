export interface ConfirmCardDialogProps {
  isOpen: boolean;
  // The purchase is being saved: the buttons wait.
  isPending: boolean;
  // What the dialog says: when the first installment is charged and which summary it goes into.
  message: string;
  // "Volver": closes the dialog and leaves the purchase unsaved.
  onBack: () => void;
  // "Sí, usar esta tarjeta": saves the purchase.
  onConfirm: () => void;
}
