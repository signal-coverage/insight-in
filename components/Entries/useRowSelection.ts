import { useState } from "react";

// One object for every render: a new Set each time would count as a change.
const NO_ROWS: ReadonlySet<string> = new Set();

// The rows ticked in a table, kept by key, for as long as the page that owns the table lives. A
// page clears it when the rows change under it (a filter, a sort, another page, a delete) and asks
// for `among` the rows it shows, so a row that went away (deleted somewhere else, say) drops out
// of the selection by itself.
export const useRowSelection = () => {
  const [selected, setSelected] = useState<ReadonlySet<string>>(NO_ROWS);

  const clear = () => setSelected(NO_ROWS);

  const among = (keys: readonly string[]): ReadonlySet<string> =>
    new Set(keys.filter((key) => selected.has(key)));

  return { select: setSelected, clear, among };
};
