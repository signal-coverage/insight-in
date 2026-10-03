import { useState } from "react";

import type { DeleteScope } from "./types";

// What the delete dialog of an installment is about to remove: just that cuota (the default) or the
// whole plan. The whole plan can only be confirmed after the user explicitly acknowledges it, and the
// acknowledgement is forgotten whenever the choice changes, so switching away and back never leaves it
// ticked.
export const useDeleteScope = () => {
  const [scope, setScope] = useState<DeleteScope>("entry");
  const [acknowledged, setAcknowledged] = useState(false);

  const selectScope = (next: DeleteScope) => {
    setScope(next);
    setAcknowledged(false);
  };

  return {
    scope,
    selectScope,
    acknowledged,
    setAcknowledged,
    canConfirm: scope === "entry" || acknowledged,
  };
};
