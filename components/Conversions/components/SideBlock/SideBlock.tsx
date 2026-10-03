import { SIDE_COPY } from "../../consts";
import { BlockHeading } from "../BlockHeading";
import { PairSection } from "./components/PairSection";
import { ROOT_CLASS_NAME } from "./styles";
import type { SideBlockProps } from "./types";

// One side of the page (the conversions received, or the purchases in another currency): a section
// for each pair of currencies that moved in the month.
export function SideBlock({ side, pairs }: SideBlockProps) {
  const { title, description, Icon, tone } = SIDE_COPY[side];

  return (
    <section className={ROOT_CLASS_NAME} aria-label={title}>
      <BlockHeading
        title={title}
        description={description}
        Icon={Icon}
        tone={tone}
      />

      {pairs.map((pair) => (
        <PairSection key={pair.id} pair={pair} />
      ))}
    </section>
  );
}
