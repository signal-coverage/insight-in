import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { SearchField } from "@heroui/react";

import { SEARCH_ARIA_LABEL, SEARCH_PLACEHOLDER } from "./consts";
import { GROUP_CLASS_NAME, ICON_CLASS_NAME, INPUT_CLASS_NAME, ROOT_CLASS_NAME } from "./styles";
import type { SidebarSearchProps } from "./types";

export function SidebarSearch({ value, onChange }: SidebarSearchProps) {
  return (
    <SearchField
      aria-label={SEARCH_ARIA_LABEL}
      value={value}
      onChange={onChange}
      className={ROOT_CLASS_NAME}
    >
      <SearchField.Group className={GROUP_CLASS_NAME}>
        <SearchField.SearchIcon className={ICON_CLASS_NAME}>
          <MagnifyingGlassIcon />
        </SearchField.SearchIcon>
        <SearchField.Input
          className={INPUT_CLASS_NAME}
          placeholder={SEARCH_PLACEHOLDER}
        />
      </SearchField.Group>
    </SearchField>
  );
}
