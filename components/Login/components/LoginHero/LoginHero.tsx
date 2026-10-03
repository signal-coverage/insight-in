import {
  CLOUD_CLASS_NAME,
  GRID_CLASS_NAME,
  HILL_CLASS_NAME,
  ROOT_CLASS_NAME,
} from "./styles";

export function LoginHero() {
  return (
    <aside className={ROOT_CLASS_NAME} aria-hidden="true">
      <div className={CLOUD_CLASS_NAME} />
      <div className={HILL_CLASS_NAME} />
      <div className={GRID_CLASS_NAME} />
    </aside>
  );
}
