import { EVOLUTION } from "../../consts";
import { BlockHeading } from "../BlockHeading";
import { EvolutionTable } from "./components/EvolutionTable";
import {
  GROUP_CLASS_NAME,
  HEADING_CLASS_NAME,
  ROOT_CLASS_NAME,
} from "./styles";
import type { EvolutionBlockProps } from "./types";
import { evolutionTitle, tableLabel } from "./utils";

// How each pair's rate moved over the last months, one small table per pair and side. Pairs are
// never mixed, so neither are their rates.
export function EvolutionBlock({ evolution }: EvolutionBlockProps) {
  return (
    <section className={ROOT_CLASS_NAME} aria-label={EVOLUTION.title}>
      <BlockHeading
        title={EVOLUTION.title}
        description={EVOLUTION.description}
        Icon={EVOLUTION.Icon}
        tone="balance"
      />

      {evolution.map((item) => (
        <div key={item.id} className={GROUP_CLASS_NAME}>
          <h3 className={HEADING_CLASS_NAME}>{evolutionTitle(item)}</h3>
          <EvolutionTable label={tableLabel(item)} rows={item.rows} />
        </div>
      ))}
    </section>
  );
}
