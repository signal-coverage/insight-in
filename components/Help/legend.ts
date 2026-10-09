import {
  CheckIcon,
  PencilSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

import {
  TIER_ICONS,
  TIER_LABELS,
} from "@/components/Cards/components/CardsTable/components/UsageCell/components/TierChip/consts";
import { PAGE_TITLE as CARDS_TITLE } from "@/components/Cards/consts";
import { MARKERS, ORIGIN_MARKER_ICON } from "@/components/Entries/markers";
import {
  ORIGIN_PREFIX as EXPENSE_ORIGIN_PREFIX,
  ORIGIN_SECTION_COPY as EXPENSE_ORIGIN_COPY,
  PAGE_TITLE as EXPENSES_TITLE,
} from "@/components/Expenses/consts";
import {
  ORIGIN_PREFIX as INCOME_ORIGIN_PREFIX,
  ORIGIN_SECTION_COPY as INCOME_ORIGIN_COPY,
  PAGE_TITLE as INCOMES_TITLE,
} from "@/components/Incomes/consts";
import { NEAR_LIMIT_PERCENT } from "@/core/cards/consts";

import {
  BESIDE_DESCRIPTION_TITLE,
  BUTTONS_AND_COLORS_TITLE,
  STATUS_AND_CARDS_TITLE,
} from "./consts";
import type { LegendGroup } from "./types";

const ORIGIN_DESCRIPTION =
  "Guarda el monto en la otra moneda como referencia, con la cotización. Los totales usan solo el monto de la columna Monto.";

const EVERYWHERE = [EXPENSES_TITLE, INCOMES_TITLE, CARDS_TITLE] as const;

// What the help page explains, in the order it shows it. Every marker the tables draw has its entry
// here, with the words and the icon the table uses (they come from the same place), and a guard
// test keeps it so.
export const LEGEND_GROUPS: readonly LegendGroup[] = [
  {
    id: "beside-description",
    title: BESIDE_DESCRIPTION_TITLE,
    entries: [
      {
        id: "recurring",
        name: MARKERS.recurring.label,
        description:
          "Se repite todos los meses. Lo gestionás desde Acciones → Gastos recurrentes (en Ingresos, desde Acciones → Recurrentes).",
        appearsIn: [EXPENSES_TITLE, INCOMES_TITLE],
        tone: "neutral",
        icon: MARKERS.recurring.icon,
        marker: { label: MARKERS.recurring.label },
      },
      {
        id: "installment",
        name: MARKERS.installment.label,
        description:
          "Es una cuota de una compra en cuotas. Todas las cuotas se crean juntas.",
        appearsIn: [EXPENSES_TITLE],
        tone: "neutral",
        icon: MARKERS.installment.icon,
        marker: { label: MARKERS.installment.label },
      },
      {
        id: "repayment",
        name: MARKERS.repayment.label,
        description: "Es una cuota de un préstamo que te devuelven en cuotas.",
        appearsIn: [INCOMES_TITLE],
        tone: "neutral",
        icon: MARKERS.repayment.icon,
        marker: { label: MARKERS.repayment.label },
      },
      {
        id: "expense-origin",
        name: EXPENSE_ORIGIN_COPY.heading,
        description: ORIGIN_DESCRIPTION,
        appearsIn: [EXPENSES_TITLE],
        tone: "neutral",
        icon: ORIGIN_MARKER_ICON,
        marker: { labelPrefix: EXPENSE_ORIGIN_PREFIX },
      },
      {
        id: "income-origin",
        name: INCOME_ORIGIN_COPY.heading,
        description: ORIGIN_DESCRIPTION,
        appearsIn: [INCOMES_TITLE],
        tone: "neutral",
        icon: ORIGIN_MARKER_ICON,
        marker: { labelPrefix: INCOME_ORIGIN_PREFIX },
      },
      {
        id: "reimbursement",
        name: MARKERS.reimbursement.label,
        description:
          "Esperás que te devuelvan parte o todo de este gasto, por ejemplo el reintegro de la obra social. Al pasar el mouse ves cuánto te deben todavía. Lo cargás en Reintegro esperado, dentro del formulario del gasto, y lo que falta cobrar suma en Reintegros pendientes del Resumen.",
        appearsIn: [EXPENSES_TITLE],
        tone: "neutral",
        icon: MARKERS.reimbursement.icon,
        marker: { label: MARKERS.reimbursement.label },
      },
      {
        id: "reimburses",
        name: MARKERS.reimburses.label,
        description:
          "Este ingreso paga, en parte o del todo, un gasto que esperabas que te devolvieran. Al pasar el mouse ves de qué gasto es. Lo vinculás en Es devolución de un gasto, dentro del formulario del ingreso.",
        appearsIn: [INCOMES_TITLE],
        tone: "neutral",
        icon: MARKERS.reimburses.icon,
        marker: { label: MARKERS.reimburses.label },
      },
    ],
  },
  {
    id: "status-and-cards",
    title: STATUS_AND_CARDS_TITLE,
    entries: [
      {
        id: "covered",
        name: MARKERS.covered.label,
        description:
          "La pagó otra persona. No se descuenta de tu plata ni cuenta en los totales.",
        appearsIn: [EXPENSES_TITLE],
        tone: "neutral",
        icon: MARKERS.covered.icon,
        marker: { label: MARKERS.covered.label },
      },
      {
        id: "tier-available",
        name: TIER_LABELS.available,
        description: `Usás hasta el ${NEAR_LIMIT_PERCENT}% del tope de la tarjeta.`,
        appearsIn: [CARDS_TITLE],
        tone: "positive",
        icon: TIER_ICONS.available,
        marker: { label: TIER_LABELS.available },
      },
      {
        id: "tier-near",
        name: TIER_LABELS.near,
        description: `Usás entre el ${NEAR_LIMIT_PERCENT}% y el 100% del tope: cuidado con las próximas compras.`,
        appearsIn: [CARDS_TITLE],
        tone: "warning",
        icon: TIER_ICONS.near,
        marker: { label: TIER_LABELS.near },
      },
      {
        id: "tier-exceeded",
        name: TIER_LABELS.exceeded,
        description: "Pasaste el tope de la tarjeta.",
        appearsIn: [CARDS_TITLE],
        tone: "danger",
        icon: TIER_ICONS.exceeded,
        marker: { label: TIER_LABELS.exceeded },
      },
    ],
  },
  {
    id: "buttons-and-colors",
    title: BUTTONS_AND_COLORS_TITLE,
    entries: [
      {
        id: "edit",
        name: "Lápiz",
        description: "Editar: abre el registro para cambiar lo que quieras.",
        appearsIn: EVERYWHERE,
        tone: "neutral",
        icon: PencilSquareIcon,
      },
      {
        id: "delete",
        name: "Tacho rojo",
        description:
          "Eliminar: borra el registro. Antes te pedimos que lo confirmes.",
        appearsIn: EVERYWHERE,
        tone: "danger",
        icon: TrashIcon,
      },
      {
        id: "settled",
        name: "Check",
        description:
          "Marcar como cobrado o pagado: tildalo cuando el dinero ya se movió.",
        appearsIn: [EXPENSES_TITLE, INCOMES_TITLE],
        tone: "positive",
        icon: CheckIcon,
      },
      {
        id: "green",
        name: "Verde",
        description:
          "Confirma plata: algo que ya cobraste, que ya pagaste o que todavía tenés disponible.",
        appearsIn: EVERYWHERE,
        tone: "positive",
      },
      {
        id: "red",
        name: "Rojo",
        description:
          "Quita algo: eliminar un registro, o una tarjeta que se pasó del tope.",
        appearsIn: EVERYWHERE,
        tone: "danger",
      },
    ],
  },
];
