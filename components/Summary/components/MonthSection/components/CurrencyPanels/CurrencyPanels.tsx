import { Skeleton, Tabs } from "@heroui/react";

import { Await } from "@/components/shared/Await";
import { visibleTabs } from "@/core/summary/tabs";

import { BlockError } from "../../../BlockError";
import { Charts } from "../../../Charts";
import { CurrencySection } from "../../../CurrencySection";
import { chartsFor, resolveCurrency } from "../../utils";
import { CurrencyPicker } from "./components/CurrencyPicker";
import { TABS_LABEL } from "./consts";
import {
  CHARTS_SKELETON_CLASS_NAME,
  INDICATOR_CLASS_NAME,
  LIST_CLASS_NAME,
  LIST_CONTAINER_CLASS_NAME,
  PANEL_CLASS_NAME,
  ROOT_CLASS_NAME,
  TAB_CLASS_NAME,
  TOOLBAR_CLASS_NAME,
} from "./styles";
import type { CurrencyPanelsProps } from "./types";

// One tab per visible currency; in the month view the selected one shows its three columns, in the
// history view its three charts (the charts promise is only awaited there). Every
// currency's numbers are already here, so a tab change never waits. The picker beside the tabs says
// which currencies are visible (it is not there when there is nothing to choose).
export function CurrencyPanels({
  view,
  rows,
  hidden,
  charts,
  selected,
  onSelect,
  retryHref,
}: CurrencyPanelsProps) {
  const tabs = visibleTabs(rows, hidden);
  const current = resolveCurrency(
    selected,
    tabs.map(({ currency }) => currency),
  );

  return (
    <Tabs
      className={ROOT_CLASS_NAME}
      selectedKey={current}
      onSelectionChange={(key) => onSelect(String(key))}
    >
      <div className={TOOLBAR_CLASS_NAME}>
        <Tabs.ListContainer className={LIST_CONTAINER_CLASS_NAME}>
          <Tabs.List aria-label={TABS_LABEL} className={LIST_CLASS_NAME}>
            {tabs.map(({ currency }) => (
              <Tabs.Tab key={currency} id={currency} className={TAB_CLASS_NAME}>
                {currency}
                <Tabs.Indicator className={INDICATOR_CLASS_NAME} />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
        {rows.length > 1 ? (
          <CurrencyPicker
            currencies={rows.map(({ currency }) => currency)}
            hidden={hidden}
          />
        ) : null}
      </div>
      {tabs.map((row) => (
        <Tabs.Panel
          key={row.currency}
          id={row.currency}
          className={PANEL_CLASS_NAME}
        >
          {view === "month" ? (
            <CurrencySection row={row} />
          ) : (
            <Await
              source={charts}
              fallback={<Skeleton className={CHARTS_SKELETON_CLASS_NAME} />}
            >
              {(result) =>
                result.status === "ok" ? (
                  <Charts row={chartsFor(result.value, row.currency)} />
                ) : (
                  <BlockError retryHref={retryHref} />
                )
              }
            </Await>
          )}
        </Tabs.Panel>
      ))}
    </Tabs>
  );
}
