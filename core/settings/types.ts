// What the user can adjust about how the app computes and shows their numbers.
export interface UserSettings {
  // Whether incomes still to collect count towards the target remainder.
  includeExpectedIncomes: boolean;
}

export type SettingsActionResult =
  { status: "success" } | { status: "error"; message: string };
