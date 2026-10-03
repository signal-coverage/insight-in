import { MARKERS } from "@/components/Entries/markers";

import { MarkerIcon } from "../MarkerIcon";
import { INSTALLMENT_MARKER_LABEL } from "./consts";
import { ROOT_CLASS_NAME } from "./styles";

// Next to the description of an installment ("compra en cuotas"). It is what tells such a row
// apart in the table: an installment repeats through its plan, so it does not wear the recurring
// icon, it wears a credit card.
export function InstallmentMarker() {
  return (
    <MarkerIcon
      icon={MARKERS.installment.icon}
      label={INSTALLMENT_MARKER_LABEL}
      className={ROOT_CLASS_NAME}
    />
  );
}
