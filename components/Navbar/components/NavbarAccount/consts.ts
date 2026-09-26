import {
  ArrowRightStartOnRectangleIcon,
  ArrowTrendingUpIcon,
  Cog6ToothIcon,
  PuzzlePieceIcon,
  QuestionMarkCircleIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";

import type { AccountMenuEntry } from "./types";

export const ACCOUNT_LABEL = "Account";
export const AVATAR_INITIAL = "A";
export const MENU_ARIA_LABEL = "Account menu";

export const ACCOUNT_MENU_ENTRIES: readonly AccountMenuEntry[] = [
  { id: "account-settings", label: "Account Settings", icon: UserCircleIcon },
  { id: "settings", label: "Settings", icon: Cog6ToothIcon },
  { id: "activity", label: "Activity", icon: ArrowTrendingUpIcon },
  { id: "help-center", label: "Help Center", icon: QuestionMarkCircleIcon },
  { id: "integration", label: "Integration", icon: PuzzlePieceIcon },
];

export const LOGOUT_ENTRY: AccountMenuEntry = {
  id: "logout",
  label: "Logout",
  icon: ArrowRightStartOnRectangleIcon,
};
