export interface BanksToolbarProps {
  query: string;
  onQueryChange: (query: string) => void;
  showArchived: boolean;
  onShowArchivedChange: (showArchived: boolean) => void;
}
