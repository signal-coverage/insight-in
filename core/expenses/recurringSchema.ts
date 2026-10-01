import { z } from "zod";

import { MAX_RECURRING_DECISIONS, RECURRING_CHOICES } from "./consts";
import type { RecurringDecisionInput } from "./types";

const decisionSchema = z
  .object({
    recurringExpenseId: z.string().trim().min(1),
    choice: z.enum(RECURRING_CHOICES),
    amount: z.string().trim().optional(),
  })
  // The amount is the one for this month only, so it only means something when enabling. How it
  // reads depends on the template's currency, which is checked where the template is known.
  .transform(
    ({ recurringExpenseId, choice, amount }): RecurringDecisionInput => {
      if (choice === "enable" && amount) {
        return { recurringExpenseId, choice, amount };
      }

      return { recurringExpenseId, choice };
    },
  );

// What the wizard sends: the rows that got a choice, nothing for the rest.
export const recurringDecisionsSchema = z
  .array(decisionSchema)
  .max(MAX_RECURRING_DECISIONS);
