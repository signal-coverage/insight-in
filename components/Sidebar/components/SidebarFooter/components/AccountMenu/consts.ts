import {
  ArrowRightStartOnRectangleIcon,
  ArrowTrendingUpIcon,
  Cog6ToothIcon,
  PuzzlePieceIcon,
  QuestionMarkCircleIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";

import type { AccountMenuEntry } from "./types";

export const MENU_ARIA_LABEL = "Menú de la cuenta";
export const ACCOUNT_FALLBACK_LABEL = "Cuenta";

export const ACCOUNT_MENU_ENTRIES: readonly AccountMenuEntry[] = [
  {
    id: "account-settings",
    label: "Configuración de la cuenta",
    icon: UserCircleIcon,
  },
  { id: "settings", label: "Configuración", icon: Cog6ToothIcon },
  { id: "activity", label: "Actividad", icon: ArrowTrendingUpIcon },
  { id: "help-center", label: "Centro de ayuda", icon: QuestionMarkCircleIcon },
  { id: "integration", label: "Integraciones", icon: PuzzlePieceIcon },
];

export const LOGOUT_ENTRY: AccountMenuEntry = {
  id: "logout",
  label: "Cerrar sesión",
  icon: ArrowRightStartOnRectangleIcon,
};
