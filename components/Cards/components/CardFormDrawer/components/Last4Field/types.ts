export interface Last4FieldProps {
  // The digits typed so far: the stored ones on edit, none for a new card.
  value: string;
  onChange: (value: string) => void;
}
