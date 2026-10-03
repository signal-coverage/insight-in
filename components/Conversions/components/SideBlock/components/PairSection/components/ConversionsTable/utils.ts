import { SIDE_COPY } from "@/components/Conversions/consts";
import type { PairView } from "@/components/Conversions/types";

// "Conversiones de USDC → ARS" / "Compras de ARS → USD": names the table for assistive technology.
export const tableLabel = (pair: PairView): string =>
  `${SIDE_COPY[pair.side].countLabel} de ${pair.id}`;
