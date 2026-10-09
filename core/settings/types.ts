// What the user can adjust about how the app computes and shows their numbers.
export interface UserSettings {
  // Whether incomes still to collect count towards the target remainder.
  includeExpectedIncomes: boolean;
  // The currencies the user hides from the month block of the summary (display only). Empty shows
  // them all, so a currency the user starts using later appears by default.
  hiddenSummaryCurrencies: string[];
}

export type SettingsActionResult =
  { status: "success" } | { status: "error"; message: string };
