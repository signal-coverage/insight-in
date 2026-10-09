import { CategoriesChart } from "./components/CategoriesChart";
import { DailyBalanceChart } from "./components/DailyBalanceChart";
import { MonthlyChart } from "./components/MonthlyChart";
import { ROOT_CLASS_NAME } from "./styles";
import type { ChartsProps } from "./types";

// The charts of one currency (the last-6-months view). Currencies are never drawn together.
export function Charts({ row }: ChartsProps) {
  return (
    <div className={ROOT_CLASS_NAME}>
      <MonthlyChart currency={row.currency} months={row.monthly} />
      <CategoriesChart currency={row.currency} categories={row.categories} />
      <DailyBalanceChart currency={row.currency} points={row.daily} />
    </div>
  );
}
