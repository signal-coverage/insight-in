import { Separator } from "@heroui/react";
import { useId } from "react";

import {
  BRAND_CLASS_NAME,
  EDGE_CLASS_NAME,
  EDGE_STYLE,
  HEADING_CLASS_NAME,
  LABEL_CLASS_NAME,
  LINE_CLASS_NAME,
  LINES_CLASS_NAME,
  NOTE_CLASS_NAME,
  PAPER_CLASS_NAME,
  SEPARATOR_CLASS_NAME,
  VALUE_CLASS_NAME,
  WRAPPER_CLASS_NAME,
} from "./styles";
import type { InstallmentTicketProps } from "./types";

// The summary of a purchase or a repayment in installments as a receipt: a small header, a thin
// separator, then one label and value per line. The torn edge is decoration only, so it is hidden
// from assistive technology.
export function InstallmentTicket({
  brand,
  heading,
  lines,
}: InstallmentTicketProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className={WRAPPER_CLASS_NAME}>
      <div className={PAPER_CLASS_NAME}>
        <p className={BRAND_CLASS_NAME}>{brand}</p>
        <h3 id={headingId} className={HEADING_CLASS_NAME}>
          {heading}
        </h3>
        <Separator className={SEPARATOR_CLASS_NAME} />
        <dl className={LINES_CLASS_NAME}>
          {lines.map(({ label, value, note }) => (
            <div key={label}>
              <div className={LINE_CLASS_NAME}>
                <dt className={LABEL_CLASS_NAME}>{label}</dt>
                <dd className={VALUE_CLASS_NAME}>{value}</dd>
              </div>
              {note ? <p className={NOTE_CLASS_NAME}>{note}</p> : null}
            </div>
          ))}
        </dl>
      </div>
      <div aria-hidden="true" className={EDGE_CLASS_NAME} style={EDGE_STYLE} />
    </section>
  );
}
