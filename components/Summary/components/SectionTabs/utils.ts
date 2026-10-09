import { DEFAULT_SECTION, type SummarySection } from "@/core/summary/tabs";

import { SECTION_PARAM } from "../../consts";

// What the address carries for a section: nothing for the default one, `section=ID` for any other.
export const sectionParams = (
  section: SummarySection,
): Record<string, string> =>
  section === DEFAULT_SECTION ? {} : { [SECTION_PARAM]: section };

// The address after a section tab is picked: the current one with only the section changed (the
// default one is not written); the month, the currency, every other parameter and the hash stay.
export const sectionAddress = (
  location: Pick<Location, "pathname" | "search" | "hash">,
  section: SummarySection,
): string => {
  const search = new URLSearchParams(location.search);
  const next = sectionParams(section)[SECTION_PARAM];

  if (next === undefined) search.delete(SECTION_PARAM);
  else search.set(SECTION_PARAM, next);

  const query = search.toString();

  return `${location.pathname}${query ? `?${query}` : ""}${location.hash}`;
};
