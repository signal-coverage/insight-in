// The page is a column of sections that scrolls with the page area around it.
export const ROOT_CLASS_NAME = "flex flex-col gap-6 px-4 pt-3 pb-6";

// Where the expected incomes switch will be, while its saved value is on its way: the same room, so
// the page does not jump when it arrives.
export const SWITCH_SKELETON_CLASS_NAME = "h-10 w-72 max-w-full rounded-xl";

// Where the "Por cuenta" section will be, while its balances are on their way: roughly its height, so
// the page does not jump when it arrives.
export const ACCOUNTS_SKELETON_CLASS_NAME = "h-40 w-full max-w-xl rounded-2xl";

// Where the attention block may be, while it is read: short, since it is often not there at all.
export const ATTENTION_SKELETON_CLASS_NAME =
  "h-16 w-full max-w-3xl rounded-2xl";
