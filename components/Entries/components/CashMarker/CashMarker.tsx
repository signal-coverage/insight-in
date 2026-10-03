import { MARKERS } from "@/components/Entries/markers";

import { MarkerIcon } from "../MarkerIcon";
import { CASH_MARKER_LABEL } from "./consts";
import { ROOT_CLASS_NAME } from "./styles";

// Next to the description of an entry that moved as cash. Digital entries, the usual case, get no
// marker at all.
export function CashMarker() {
  return (
    <MarkerIcon
      icon={MARKERS.cash.icon}
      label={CASH_MARKER_LABEL}
      className={ROOT_CLASS_NAME}
    />
  );
}
