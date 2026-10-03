import type { UserSettings } from "./types";

// The target remainder shows on the summary, so changing a setting refreshes that page.
export const OVERVIEW_PATH = "/dashboard/overview";

// Where the settings are changed. The page shows the saved values, so it is refreshed too: its
// switch keeps the chosen value only until the save is over, and then shows what the page was given.
export const SETTINGS_PATH = "/dashboard/settings";

// What a user who never saved a setting gets: counting the incomes still to collect is the
// behaviour the target remainder always had.
export const DEFAULT_SETTINGS: UserSettings = {
  includeExpectedIncomes: true,
};

export const INVALID_SETTING_MESSAGE = "No se pudo guardar la preferencia.";
