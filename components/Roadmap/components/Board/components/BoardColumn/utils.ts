import type { DropItem, Key } from "react-aria-components";

import { placeIndex } from "@/core/roadmap/board";
import type {
  BoardItem,
  BoardStatus,
  MoveItemInput,
} from "@/core/roadmap/types";

import { DRAG_TYPE } from "./consts";

// What the dragged cards carry: their ids, under the one type the columns accept, and their titles as
// plain text for anything that wants to show what is being dragged.
export const dragItemsFor = (
  keys: ReadonlySet<Key>,
  items: readonly BoardItem[],
): Record<string, string>[] =>
  [...keys].map((key) => ({
    [DRAG_TYPE]: String(key),
    "text/plain": items.find((item) => item.id === key)?.title ?? "",
  }));

// The ids of the cards of the board among what was dropped. Anything else (a file, some text from
// another page) is not a card and is left out.
export const droppedIds = async (
  items: readonly DropItem[],
): Promise<string[]> => {
  const reads = items.flatMap((dropped) =>
    dropped.kind === "text" && dropped.types.has(DRAG_TYPE)
      ? [dropped.getText(DRAG_TYPE)]
      : [],
  );

  return Promise.all(reads);
};

// The move a drop asks for: the card `id` into the column `status`, next to the card the drop landed
// beside, or at the end of the column when it landed on the column itself (`target` null).
export const dropRequest = (
  status: BoardStatus,
  columnIds: readonly string[],
  id: string,
  target: { key: Key; dropPosition: "before" | "after" | "on" } | null,
): MoveItemInput => ({
  id,
  status,
  index: target
    ? placeIndex(
        columnIds,
        String(target.key),
        target.dropPosition === "before" ? "before" : "after",
        id,
      )
    : columnIds.filter((columnId) => columnId !== id).length,
});
