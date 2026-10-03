export interface DayFieldProps {
  // The field name the form submits the day under.
  name: string;
  label: string;
  // What the day means, under the field.
  hint: string;
  // The day typed so far (NaN while the field is empty). The form owns it, so the card preview can
  // follow it.
  value: number;
  onChange: (day: number) => void;
}
