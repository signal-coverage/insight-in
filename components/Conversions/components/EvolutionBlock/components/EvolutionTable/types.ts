import type { EvolutionRowView } from "@/components/Conversions/types";

export interface EvolutionTableProps {
  // Names the table for assistive technology.
  label: string;
  // Oldest first.
  rows: EvolutionRowView[];
}
