// What the field needs to know about a card to offer it.
export interface CardChoice {
  id: string;
  // "Visa •••• 1234".
  title: string;
  currency: string;
}

export interface CardFieldProps {
  cards: readonly CardChoice[];
  // Only the cards in this currency are offered: a purchase is never paid with a card in another one.
  currency: string;
  // The id of the card chosen, or null for no card.
  value: string | null;
  onChange: (cardId: string | null) => void;
  // What the server said about the card, shown under the field.
  errorMessage?: string;
  // The user has to pick a card: there is no "Sin tarjeta" option.
  isRequired?: boolean;
}
