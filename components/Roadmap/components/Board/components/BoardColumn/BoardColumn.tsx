import { PlusIcon } from "@heroicons/react/24/outline";
import { Button, Chip } from "@heroui/react";
import { GridList } from "react-aria-components";

import { COLUMN_TITLES } from "@/components/Roadmap/consts";
import { COLUMN_CLASS_NAME } from "@/components/Roadmap/styles";

import { BoardCard } from "./components/BoardCard";
import { EmptyColumn } from "./components/EmptyColumn";
import { addLabel, listLabel } from "./consts";
import {
  ADD_ICON_CLASS_NAME,
  HEADER_CLASS_NAME,
  LIST_CLASS_NAME,
  TITLE_CLASS_NAME,
} from "./styles";
import type { BoardColumnProps } from "./types";
import { useColumnDragAndDrop } from "./useColumnDragAndDrop";

// One column of the board: its title, how many cards it holds, a button to add one, and the cards.
// The cards are a React Aria GridList (not a ListBox) because each card holds buttons of its own,
// which a list of options cannot; HeroUI's ListBox is a thin skin over the same React Aria
// primitive and has no grid variant.
export function BoardColumn({
  status,
  items,
  onMove,
  onMoveToEnd,
  onAdd,
  onEdit,
  onDelete,
}: BoardColumnProps) {
  const title = COLUMN_TITLES[status];
  const { dragAndDropHooks } = useColumnDragAndDrop({ status, items, onMove });

  return (
    <section className={COLUMN_CLASS_NAME} aria-label={title}>
      <header className={HEADER_CLASS_NAME}>
        <h2 className={TITLE_CLASS_NAME}>{title}</h2>
        <Chip size="sm" variant="soft">
          {items.length}
        </Chip>
        <Button
          isIconOnly
          size="sm"
          variant="secondary"
          aria-label={addLabel(title)}
          onPress={() => onAdd(status)}
        >
          <PlusIcon className={ADD_ICON_CLASS_NAME} aria-hidden="true" />
        </Button>
      </header>

      <GridList
        aria-label={listLabel(title)}
        items={items}
        dragAndDropHooks={dragAndDropHooks}
        renderEmptyState={() => <EmptyColumn />}
        className={LIST_CLASS_NAME}
      >
        {(item) => (
          <BoardCard
            item={item}
            onMove={onMoveToEnd}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        )}
      </GridList>
    </section>
  );
}
