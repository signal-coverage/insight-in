import type { ReactNode } from "react";

import type { ActionsMenuItem } from "./components/ActionsMenu";

interface PageHeaderBaseProps {
  title: string;
  description: string;
  // Anything the page needs beside its title, on the side where the Actions button goes (the
  // summary's month selector).
  aside?: ReactNode;
}

// A page with actions: the Actions button and its menu are always given together.
interface PageHeaderWithActionsProps extends PageHeaderBaseProps {
  // The Actions button's text.
  actionsLabel: string;
  // What the Actions menu offers, in order.
  actions: readonly ActionsMenuItem[];
  // Receives the id of the action the user chose.
  onAction: (id: string) => void;
}

// A page with nothing to do (the summary) has no Actions button at all.
interface PageHeaderWithoutActionsProps extends PageHeaderBaseProps {
  actionsLabel?: never;
  actions?: never;
  onAction?: never;
}

export type PageHeaderProps =
  PageHeaderWithActionsProps | PageHeaderWithoutActionsProps;
