export interface MonthSelectorProps {
  // The month shown, written "YYYY-MM".
  month: string;
  // The same month written out ("Septiembre de 2026").
  label: string;
  // The month in course, "YYYY-MM": where "Mes actual" goes, and the month whose address is bare.
  currentMonth: string;
  // The page the selector belongs to, whose address carries the month. The summary when omitted.
  basePath?: string;
  // Other parameters the page keeps in its address when the month changes (the summary's currency).
  params?: Readonly<Record<string, string>>;
}
