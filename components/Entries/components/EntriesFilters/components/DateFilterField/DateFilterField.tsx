import { useState } from "react";

import { DatePickerField } from "../../../DatePickerField";
import type { DateFilterFieldProps } from "../../types";
import { isCommittableDate } from "../../utils";

// Keeps what is being typed locally and only reports complete, plausible dates: the year is
// typed digit by digit, and every intermediate year (0002, 0020, ...) is a valid date that
// would otherwise trigger a navigation. The picker is controlled by the draft, so it is never
// snapped back mid-typing. It follows the URL when the committed value changes from outside
// (back button, Clear filters).
export function DateFilterField({
  label,
  name,
  value,
  className,
  onCommit,
}: DateFilterFieldProps) {
  const [draft, setDraft] = useState<string | null>(value);
  const [seenValue, setSeenValue] = useState(value);

  if (seenValue !== value) {
    setSeenValue(value);
    setDraft(value);
  }

  const handleChange = (next: string | null) => {
    setDraft(next);

    if (isCommittableDate(next ?? "") && next !== value) {
      onCommit(next);
    }
  };

  return (
    <DatePickerField
      label={label}
      name={name}
      className={className}
      value={draft}
      onChange={handleChange}
    />
  );
}
