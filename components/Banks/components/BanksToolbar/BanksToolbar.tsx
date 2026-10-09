import { SearchField, Switch } from "@heroui/react";

import { FIELD_VARIANT } from "@/components/Entries/styles";

import {
  SEARCH_LABEL,
  SEARCH_PLACEHOLDER,
  SHOW_ARCHIVED_LABEL,
} from "./consts";
import { ROOT_CLASS_NAME, SEARCH_CLASS_NAME } from "./styles";
import type { BanksToolbarProps } from "./types";

// What narrows the board: a search over bank and account names, and whether archived items show.
// Both are controlled by the page, which applies them to the rows.
export function BanksToolbar({
  query,
  onQueryChange,
  showArchived,
  onShowArchivedChange,
}: BanksToolbarProps) {
  return (
    <div className={ROOT_CLASS_NAME}>
      <SearchField
        aria-label={SEARCH_LABEL}
        variant={FIELD_VARIANT}
        className={SEARCH_CLASS_NAME}
        value={query}
        onChange={onQueryChange}
      >
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder={SEARCH_PLACEHOLDER} />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>
      <Switch isSelected={showArchived} onChange={onShowArchivedChange}>
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          {SHOW_ARCHIVED_LABEL}
        </Switch.Content>
      </Switch>
    </div>
  );
}
