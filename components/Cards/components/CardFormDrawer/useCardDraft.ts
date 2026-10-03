import { useState } from "react";

import type { CardBrand } from "@/core/cards/types";

import type { CardRow } from "../../types";
import { DEFAULT_BRAND, DEFAULT_CLOSING_DAY, DEFAULT_DUE_DAY } from "./consts";
import type { CardDraft } from "./types";

// The values the form starts with — the stored ones on edit, the defaults for a new card — and the
// state that follows them as the user types, so the card preview can show them live.
export function useCardDraft(card: CardRow | null): CardDraft {
  const [last4, setLast4] = useState(card?.last4 ?? "");
  const [brand, setBrand] = useState<CardBrand>(card?.brand ?? DEFAULT_BRAND);
  const [closingDay, setClosingDay] = useState(
    card?.closingDay ?? DEFAULT_CLOSING_DAY,
  );
  const [dueDay, setDueDay] = useState(card?.dueDay ?? DEFAULT_DUE_DAY);

  return {
    last4,
    brand,
    closingDay,
    dueDay,
    setLast4,
    setBrand,
    setClosingDay,
    setDueDay,
  };
}
