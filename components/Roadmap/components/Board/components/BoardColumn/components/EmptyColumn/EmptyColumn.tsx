import { EMPTY_HINT } from "./consts";
import { ROOT_CLASS_NAME } from "./styles";

// What a column with no cards says, which is also where a card can be dropped.
export function EmptyColumn() {
  return <p className={ROOT_CLASS_NAME}>{EMPTY_HINT}</p>;
}
