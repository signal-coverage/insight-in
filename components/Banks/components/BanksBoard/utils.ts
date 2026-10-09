import {
  ALL_ARCHIVED_MESSAGE,
  NO_BANKS_MESSAGE,
  NO_RESULTS_MESSAGE,
} from "./consts";

// What an empty board says. A search wins; without one, an empty board with archived banks around
// means they are all hidden by the archived toggle.
export const emptyMessage = (
  isSearching: boolean,
  hasArchivedBanks: boolean,
): string => {
  if (isSearching) {
    return NO_RESULTS_MESSAGE;
  }

  return hasArchivedBanks ? ALL_ARCHIVED_MESSAGE : NO_BANKS_MESSAGE;
};
