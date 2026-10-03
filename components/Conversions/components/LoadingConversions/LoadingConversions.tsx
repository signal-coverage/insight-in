import { MetricCard } from "@/components/shared/MetricCard";

import { LOADING_LABEL, SIDE_COPY } from "../../consts";
import { cardLabels } from "../../utils";
import { BlockHeading } from "../BlockHeading";
import { CARDS_CLASS_NAME, GROUP_CLASS_NAME, ROOT_CLASS_NAME } from "./styles";
import { SIDES } from "./consts";

// The page while its figures are on the way: each side already says what it is and names its cards,
// with a skeleton where the amounts will be. It carries no pair and no amount: either would read as
// a real result before the data is here.
export function LoadingConversions() {
  return (
    <section
      className={ROOT_CLASS_NAME}
      aria-label={LOADING_LABEL}
      aria-busy="true"
    >
      {SIDES.map((side) => {
        const { title, description, Icon, tone } = SIDE_COPY[side];

        return (
          <div key={side} className={GROUP_CLASS_NAME}>
            <BlockHeading
              title={title}
              description={description}
              Icon={Icon}
              tone={tone}
            />
            <ul className={CARDS_CLASS_NAME}>
              {cardLabels(side).map((label) => (
                <MetricCard key={label} label={label} tone={tone} isLoading />
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
