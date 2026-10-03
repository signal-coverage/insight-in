import type { Source } from "@/components/shared/Await";

export interface SettingsProps {
  // The saved "Sumar ingresos por cobrar" setting, as the summary gets it: a value, or a promise the
  // page started so its header does not wait for the database.
  includeExpectedIncomes: Source<boolean>;
}
