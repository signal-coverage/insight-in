// What the user is still expected to be paid back in one currency, in minor units.
export interface PendingReimbursement {
  currency: string;
  amount: number;
}

// An expense that expects a reimbursement, as far as the figures are concerned.
export interface ExpectedExpense {
  id: string;
  currency: string;
  // Minor units, always positive.
  expectedReimbursement: number;
}

// What the incomes linked to one expense add up to (minor units).
export interface ReceivedTotal {
  expenseId: string;
  amount: number;
}

// An expense an income can be linked to, with how much of its reimbursement is still outstanding.
export interface ReimbursableExpense {
  id: string;
  description: string;
  // "YYYY-MM-DD".
  date: string;
  currency: string;
  // Minor units.
  outstanding: number;
}
