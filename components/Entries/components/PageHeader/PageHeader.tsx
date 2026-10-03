import { ActionsMenu } from "./components/ActionsMenu";
import {
  DESCRIPTION_CLASS_NAME,
  ROOT_CLASS_NAME,
  TEXT_CLASS_NAME,
  TITLE_CLASS_NAME,
} from "./styles";
import type { PageHeaderProps } from "./types";

// The top of a page: what it is, and, when the page can do things, the one Actions menu with
// everything it can do.
export function PageHeader({
  title,
  description,
  aside,
  actionsLabel,
  actions,
  onAction,
}: PageHeaderProps) {
  return (
    <header className={ROOT_CLASS_NAME}>
      <div className={TEXT_CLASS_NAME}>
        <h1 className={TITLE_CLASS_NAME}>{title}</h1>
        <p className={DESCRIPTION_CLASS_NAME}>{description}</p>
      </div>
      {actions ? (
        <ActionsMenu label={actionsLabel} items={actions} onAction={onAction} />
      ) : null}
      {aside}
    </header>
  );
}
