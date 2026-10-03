import { EVOLUTION, SIDE_NAMES } from "../../consts";
import type { EvolutionView } from "../../types";

// "Ingresos · USDC → ARS": which side the pair belongs to, since the same two currencies can show up
// on both.
export const evolutionTitle = ({ side, pair }: EvolutionView): string =>
  `${SIDE_NAMES[side]} · ${pair}`;

export const tableLabel = ({ pair }: EvolutionView): string =>
  `${EVOLUTION.title} ${pair}`;
