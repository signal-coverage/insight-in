import { PageHeader } from "@/components/Entries/components/PageHeader";

import { LegendGroup } from "./components/LegendGroup";
import { PAGE_DESCRIPTION, PAGE_TITLE } from "./consts";
import { LEGEND_GROUPS } from "./legend";
import { GROUPS_CLASS_NAME, ROOT_CLASS_NAME } from "./styles";

// What every icon and colour of the app means, grouped by where the user meets them.
export function Help() {
  return (
    <main className={ROOT_CLASS_NAME}>
      <PageHeader title={PAGE_TITLE} description={PAGE_DESCRIPTION} />

      <div className={GROUPS_CLASS_NAME}>
        {LEGEND_GROUPS.map((group) => (
          <LegendGroup key={group.id} group={group} />
        ))}
      </div>
    </main>
  );
}
