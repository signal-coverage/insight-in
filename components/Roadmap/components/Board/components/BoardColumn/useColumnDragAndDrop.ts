import { createElement } from "react";
import { DropIndicator, useDragAndDrop } from "react-aria-components";

import type { BoardItem } from "@/core/roadmap/types";

import { DRAG_TYPE } from "./consts";
import { DROP_INDICATOR_CLASS_NAME } from "./styles";
import type { ColumnDragAndDropOptions } from "./types";
import { dragItemsFor, droppedIds, dropRequest } from "./utils";

// The drag and drop of one column, with React Aria's `useDragAndDrop`: the cards of the column can be
// picked up (by pointer, touch or keyboard) and the column accepts cards, from itself (a reorder) and
// from the other columns (an insert), and on its own empty area (a root drop, which is how a card
// reaches an empty column). Every way a card can land ends in the same `onMove` request, and what
// happens next (the optimistic update and the save) is the board's.
export const useColumnDragAndDrop = ({
  status,
  items,
  onMove,
}: ColumnDragAndDropOptions) => {
  const columnIds = items.map((item) => item.id);

  return useDragAndDrop<BoardItem>({
    getItems: (keys) => dragItemsFor(keys, items),
    getAllowedDropOperations: () => ["move"],
    acceptedDragTypes: [DRAG_TYPE],
    // A card dropped in the column it came from.
    onReorder: ({ keys, target }) => {
      const [id] = [...keys];

      if (id !== undefined) {
        onMove(dropRequest(status, columnIds, String(id), target));
      }
    },
    // A card dropped between the cards of this column, coming from another one.
    onInsert: async ({ items: dropped, target }) => {
      const [id] = await droppedIds(dropped);

      if (id) {
        onMove(dropRequest(status, columnIds, id, target));
      }
    },
    // A card dropped on the column itself: the end of it, which is the only place of an empty column.
    onRootDrop: async ({ items: dropped }) => {
      const [id] = await droppedIds(dropped);

      if (id) {
        onMove(dropRequest(status, columnIds, id, null));
      }
    },
    renderDropIndicator: (target) =>
      createElement(DropIndicator, {
        target,
        className: DROP_INDICATOR_CLASS_NAME,
      }),
  });
};
