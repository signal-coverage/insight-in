import { z } from "zod";

import { INVALID_SETTING_MESSAGE } from "./consts";

// A strict boolean: the text "false" is not one, and would otherwise be easy to read as truthy.
export const includeExpectedIncomesSchema = z.boolean({
  error: INVALID_SETTING_MESSAGE,
});
