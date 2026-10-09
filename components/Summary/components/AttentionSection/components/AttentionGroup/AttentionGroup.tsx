import { Link } from "@heroui/react";

import {
  groupHeadingId,
  linkAriaLabel,
  moreLabel,
  usedOfLimit,
} from "./consts";
import {
  AMOUNT_CLASS_NAME,
  DANGER_AMOUNT_CLASS_NAME,
  DATE_CLASS_NAME,
  HEADER_CLASS_NAME,
  LINK_CLASS_NAME,
  LIST_CLASS_NAME,
  MORE_CLASS_NAME,
  NAME_CLASS_NAME,
  ROOT_CLASS_NAME,
  ROW_CLASS_NAME,
  TEXT_CLASS_NAME,
  TITLE_CLASS_NAME,
} from "./styles";
import type { AttentionGroupProps } from "./types";

// One kind of thing that needs attention: its title and the link to where it is resolved, then the
// most urgent lines, each with what it is, when and how much in its own currency.
export function AttentionGroup({ group }: AttentionGroupProps) {
  const headingId = groupHeadingId(group.kind);

  return (
    <div className={ROOT_CLASS_NAME} role="group" aria-labelledby={headingId}>
      <div className={HEADER_CLASS_NAME}>
        <h3 id={headingId} className={TITLE_CLASS_NAME}>
          {group.title}
        </h3>
        <Link
          href={group.href}
          className={LINK_CLASS_NAME}
          aria-label={linkAriaLabel(group.linkLabel, group.title)}
        >
          {group.linkLabel}
        </Link>
      </div>
      <ul className={LIST_CLASS_NAME}>
        {group.items.map((item) => (
          <li key={item.id} className={ROW_CLASS_NAME}>
            <span className={TEXT_CLASS_NAME}>
              <span className={NAME_CLASS_NAME} title={item.title}>
                {item.title}
              </span>
              {item.dateLabel ? (
                <span className={DATE_CLASS_NAME}>{item.dateLabel}</span>
              ) : null}
            </span>
            <span
              className={
                item.severity === "danger"
                  ? DANGER_AMOUNT_CLASS_NAME
                  : AMOUNT_CLASS_NAME
              }
            >
              {item.limitLabel
                ? usedOfLimit(item.amountLabel, item.limitLabel)
                : item.amountLabel}
            </span>
          </li>
        ))}
      </ul>
      {group.hiddenCount > 0 ? (
        <p className={MORE_CLASS_NAME}>{moreLabel(group.hiddenCount)}</p>
      ) : null}
    </div>
  );
}
