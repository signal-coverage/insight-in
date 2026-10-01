import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

export const ICONS = {
  error: ExclamationCircleIcon,
  success: CheckCircleIcon,
  warning: ExclamationTriangleIcon,
} as const;
