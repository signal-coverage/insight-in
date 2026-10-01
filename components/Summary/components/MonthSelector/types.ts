export interface MonthSelectorProps {
  // The month shown, written "YYYY-MM".
  month: string;
  // The same month written out ("Septiembre de 2026").
  label: string;
  // The month in course, "YYYY-MM": where "Mes actual" goes, and the month whose address is bare.
  currentMonth: string;
}
