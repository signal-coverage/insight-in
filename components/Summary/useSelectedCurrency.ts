import { useSearchParams } from "next/navigation";

import { parseCurrencyParam, parseSectionParam } from "@/core/summary/tabs";

import { currencyParams } from "./components/MonthSection/utils";
import { monthHref } from "./components/MonthSelector/utils";
import { sectionParams } from "./components/SectionTabs/utils";
import { CURRENCY_PARAM, SECTION_PARAM, SUMMARY_PATH } from "./consts";

// The currency tab and the section tab the address asks for (the address is the only source of both),
// what the addresses of this page carry for them, and the address that loads this page again as it is
// now (month, section and currency tab).
export const useSelectedCurrency = (month: string, currentMonth: string) => {
  const searchParams = useSearchParams();
  const selected = parseCurrencyParam(
    searchParams.get(CURRENCY_PARAM) ?? undefined,
  );
  const section = parseSectionParam(
    searchParams.get(SECTION_PARAM) ?? undefined,
  );
  const params = { ...currencyParams(selected), ...sectionParams(section) };

  return {
    selected,
    section,
    params,
    retryHref: monthHref(month, currentMonth, SUMMARY_PATH, params),
  };
};
