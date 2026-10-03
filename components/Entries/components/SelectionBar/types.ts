export interface SelectionBarProps {
  // How many rows are selected (at least one: the bar is not shown without a selection).
  count: number;
  // Locks both buttons (while a delete is on its way).
  isDisabled?: boolean;
  onClear: () => void;
  onDelete: () => void;
}
