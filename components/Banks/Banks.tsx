"use client";

import { useOverlayState } from "@heroui/react";
import { useState } from "react";

import { PageHeader } from "@/components/Entries/components/PageHeader";
import { ROOT_CLASS_NAME } from "@/components/Entries/styles";
import { Await } from "@/components/shared/Await";
import { activeBanks, filterBanks } from "@/core/banks/board";
import type {
  BankWithAccounts,
  BoardAccount,
  BoardBank,
} from "@/core/banks/types";

import { AccountFormDrawer } from "./components/AccountFormDrawer";
import { BankFormDrawer } from "./components/BankFormDrawer";
import { BanksBoard } from "./components/BanksBoard";
import { BanksToolbar } from "./components/BanksToolbar";
import { LoadingBoard } from "./components/LoadingBoard";
import {
  ACTION_ITEMS,
  ACTIONS_LABEL,
  CREATE_ACCOUNT_ACTION,
  CREATE_BANK_ACTION,
  INITIAL_ACCOUNT_TARGET,
  INITIAL_BANK_TARGET,
  PAGE_DESCRIPTION,
  PAGE_TITLE,
} from "./consts";
import type { AccountFormTarget, BankFormTarget, BanksProps } from "./types";

export function Banks({ board }: BanksProps) {
  const bankForm = useOverlayState();
  const accountForm = useOverlayState();
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [bankTarget, setBankTarget] =
    useState<BankFormTarget>(INITIAL_BANK_TARGET);
  const [accountTarget, setAccountTarget] = useState<AccountFormTarget>(
    INITIAL_ACCOUNT_TARGET,
  );

  const openBankForm = (bank: BankWithAccounts | null) => {
    setBankTarget((current) => ({ key: current.key + 1, bank }));
    bankForm.open();
  };

  const openAccountForm = (
    account: BoardAccount | null,
    bankId: string | null,
  ) => {
    setAccountTarget((current) => ({ key: current.key + 1, account, bankId }));
    accountForm.open();
  };

  const handleHeaderAction = (id: string) => {
    if (id === CREATE_BANK_ACTION) {
      openBankForm(null);
    } else if (id === CREATE_ACCOUNT_ACTION) {
      openAccountForm(null, null);
    }
  };

  // The board and the two drawers need the banks, so they appear once the data has arrived (the
  // header and the toolbar are already on screen). The drawers get the whole list, not the filtered
  // one: what is hidden by the search still counts (a bank with a hidden active account cannot be
  // archived).
  const renderBanks = (banks: readonly BoardBank[]) => (
    <>
      <BanksBoard
        banks={filterBanks(banks, { query, showArchived })}
        isSearching={query.trim() !== ""}
        hasArchivedBanks={banks.some((bank) => bank.archived)}
        onEditBank={(bankId) => {
          const bank = banks.find((candidate) => candidate.id === bankId);

          if (bank) {
            openBankForm(bank);
          }
        }}
        onEditAccount={(account) => openAccountForm(account, null)}
        onAddAccount={(bankId) => openAccountForm(null, bankId)}
        onAddBank={() => openBankForm(null)}
      />

      <BankFormDrawer
        isOpen={bankForm.isOpen}
        onOpenChange={bankForm.setOpen}
        onClose={bankForm.close}
        target={bankTarget}
      />

      <AccountFormDrawer
        isOpen={accountForm.isOpen}
        onOpenChange={accountForm.setOpen}
        onClose={accountForm.close}
        target={accountTarget}
        banks={activeBanks(banks)}
      />
    </>
  );

  return (
    <main className={ROOT_CLASS_NAME}>
      <PageHeader
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        actionsLabel={ACTIONS_LABEL}
        actions={ACTION_ITEMS}
        onAction={handleHeaderAction}
      />

      <BanksToolbar
        query={query}
        onQueryChange={setQuery}
        showArchived={showArchived}
        onShowArchivedChange={setShowArchived}
      />

      <Await source={board} fallback={<LoadingBoard />}>
        {renderBanks}
      </Await>
    </main>
  );
}
