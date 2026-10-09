// Validated account data. The currency is an ISO code the app supports.
export interface AccountInput {
  name: string;
  currency: string;
}

export interface CreateAccountInput extends AccountInput {
  bankId: string;
}

// An account as the client reads it: no owner, and the archive date as a flag.
export interface Account extends AccountInput {
  id: string;
  bankId: string;
  archived: boolean;
}

// An account as the entry forms offer it: "Banco · Cuenta", its currency, and whether it is archived
// (an archived account is only offered to the record that already has it).
export interface AccountChoice {
  id: string;
  currency: string;
  label: string;
  archived: boolean;
}
