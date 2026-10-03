import { BOARD_STATUSES } from "./consts";
import type { BoardColumns, BoardItem, MoveItemInput } from "./types";

export const emptyColumns = (): BoardColumns => ({
  IDEA: [],
  TODO: [],
  DONE: [],
  DEPLOYED: [],
});

// The cards split by column, each column keeping the order the cards came in.
export const groupByStatus = (items: readonly BoardItem[]): BoardColumns => {
  const columns = emptyColumns();

  for (const item of items) {
    columns[item.status].push(item);
  }

  return columns;
};

// The board with a card moved: out of the column it was in, into `status` at `index` (counted among
// the cards that stay in that column, so the card itself never shifts the place). Pure, and shared by
// the optimistic update on the client and the tests; the server computes the same place from the
// database. A card that is not on the board leaves the board as it was.
export const moveInColumns = (
  columns: BoardColumns,
  { id, status, index }: MoveItemInput,
): BoardColumns => {
  const from = BOARD_STATUSES.find((candidate) =>
    columns[candidate].some((item) => item.id === id),
  );

  if (!from) {
    return columns;
  }

  const moving = columns[from].find((item) => item.id === id) as BoardItem;
  const stay = columns[status].filter((item) => item.id !== id);
  const place = Math.min(Math.max(index, 0), stay.length);

  return {
    ...columns,
    [from]: columns[from].filter((item) => item.id !== id),
    [status]: [
      ...stay.slice(0, place),
      { ...moving, status },
      ...stay.slice(place),
    ],
  };
};

// The place a card takes when it is dropped `position` the card `targetId`, counted among the cards
// that stay in the column (`movingId` is one of the column's ids when it is reordered inside it, and
// does not count). A target that is no longer in the column sends the card to the end.
export const placeIndex = (
  columnIds: readonly string[],
  targetId: string,
  position: "before" | "after",
  movingId: string,
): number => {
  const staying = columnIds.filter((id) => id !== movingId);
  const at = staying.indexOf(targetId);

  if (at === -1) {
    return staying.length;
  }

  return position === "before" ? at : at + 1;
};
