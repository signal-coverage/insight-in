import {
  ArrowTrendingUpIcon,
  ArrowsRightLeftIcon,
} from "@heroicons/react/24/outline";

import type { ConversionSide } from "@/core/conversions/types";

import type { PairCardId, SideCopy } from "./types";

export const PAGE_TITLE = "Conversiones";
export const PAGE_DESCRIPTION =
  "Cuánto cambiaste, a qué cotización y cómo se movió mes a mes.";

// Where the page lives; the month goes in its address (`?month=2026-03`), like the summary's.
export const CONVERSIONS_PATH = "/dashboard/overview/insights";

export const SIDE_COPY: Readonly<Record<ConversionSide, SideCopy>> = {
  income: {
    title: "Conversiones recibidas",
    description: "Ingresos cuyo monto neto vino de otra moneda.",
    Icon: ArrowsRightLeftIcon,
    tone: "income",
    countLabel: "Conversiones",
    originLabel: "Origen enviado",
    netLabel: "Neto recibido",
  },
  expense: {
    title: "Compras en otra moneda",
    description: "Gastos que tenían precio en otra moneda.",
    Icon: ArrowsRightLeftIcon,
    tone: "expense",
    countLabel: "Compras",
    originLabel: "Precio de origen",
    netLabel: "Pagado",
  },
};

// The cards of a pair, in order. Their labels depend on the side (see SIDE_COPY) except these.
export const PAIR_CARD_IDS: readonly PairCardId[] = [
  "count",
  "origin",
  "net",
  "average",
  "best",
  "worst",
  "last",
];

export const RATE_LABELS = {
  average: "Cotización promedio",
  best: "Mejor cotización",
  worst: "Peor cotización",
  last: "Última cotización",
} as const;

// A cell of the evolution table with nothing to compare against.
export const NO_VARIATION = "—";

export const EVOLUTION = {
  title: "Evolución de la cotización",
  description:
    "La cotización promedio de cada mes en los últimos 6 meses, por par de monedas.",
  Icon: ArrowTrendingUpIcon,
  monthHeader: "Mes",
  rateHeader: "Cotización",
  variationHeader: "Variación",
  loadingLabel: "Cargando evolución",
} as const;

// What the evolution's titles call each side ("Ingresos · USDC → ARS").
export const SIDE_NAMES: Readonly<Record<ConversionSide, string>> = {
  income: "Ingresos",
  expense: "Gastos",
};

export const TABLE_HEADERS = {
  date: "Fecha",
  description: "Descripción",
  rate: "Cotización",
} as const;

export const LOADING_LABEL = "Cargando conversiones";

export const EMPTY_TITLE = "No hay conversiones este mes";
export const EMPTY_HINT =
  "Cargá el monto de origen al registrar un ingreso o un gasto.";
