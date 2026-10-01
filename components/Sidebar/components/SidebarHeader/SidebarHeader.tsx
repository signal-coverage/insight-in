import { BRAND_NAME, LOGO_LETTER } from "./consts";
import {
  BRAND_CLASS_NAME,
  getRootClassName,
  LOGO_MARK_CLASS_NAME,
  WORDMARK_CLASS_NAME,
} from "./styles";
import type { SidebarHeaderProps } from "./types";

export function SidebarHeader({ isCollapsed }: SidebarHeaderProps) {
  return (
    <header className={getRootClassName(isCollapsed)}>
      <div className={BRAND_CLASS_NAME}>
        <span className={LOGO_MARK_CLASS_NAME} aria-hidden="true">
          {LOGO_LETTER}
        </span>
        {!isCollapsed && (
          <span className={WORDMARK_CLASS_NAME}>{BRAND_NAME}</span>
        )}
      </div>
    </header>
  );
}
