// Takes every column's width from its own class, so the skeleton and the data line up; below the
// minimum the table scrolls sideways instead of squeezing the text.
export const TRANSFERS_TABLE_CLASS_NAME = "table-fixed min-w-[56rem]";

// "Banco · Cuenta" is cut with an ellipsis instead of spilling into the next column.
export const TRANSFER_ACCOUNT_COLUMN_CLASS_NAME =
  "w-56 overflow-hidden text-ellipsis";

export const CURRENCY_COLUMN_CLASS_NAME = "w-24";
