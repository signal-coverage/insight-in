export interface RecurringNoticeProps {
  // How many recurring expenses still have no decision for the current month.
  pendingCount: number;
  onResolve: () => void;
}
