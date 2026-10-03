// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_ENTRIES_QUERY, hasActiveFilters } from "@/core/entries/query";
import type { EntriesQuery } from "@/core/entries/query";

import { EntriesFilters } from "./EntriesFilters";

const COPY = { ariaLabel: "Filtrar ingresos", settledLabel: "Cobrado" };

const CATEGORIES = [
  { id: "c1", name: "Freelance" },
  { id: "c2", name: "Salary" },
];

// Whether "Limpiar filtros" shows is decided by the parent (it knows what the default state is),
// so by default the helper answers like the simplest parent: any filter set.
const renderFilters = (
  patch: Partial<EntriesQuery> = {},
  canClear: boolean = hasActiveFilters({ ...DEFAULT_ENTRIES_QUERY, ...patch }),
) => {
  const onChange = vi.fn();
  const onClear = vi.fn();

  render(
    <EntriesFilters
      {...COPY}
      query={{ ...DEFAULT_ENTRIES_QUERY, ...patch }}
      categories={CATEGORIES}
      currencies={["ARS", "USD"]}
      canClear={canClear}
      onChange={onChange}
      onClear={onClear}
    />,
  );

  return { onChange, onClear };
};

// The date pickers submit ISO dates through a named hidden input, which is the stable thing to
// read (their visible segments are several spinbuttons, not one labelled value).
const dateValue = (name: "from" | "to") =>
  (document.querySelector(`input[name="${name}"]`) as HTMLInputElement).value;

// Opens the calendar of the From (0) or To (1) picker and picks a day of the visible month.
const pickDay = async (picker: 0 | 1, day: string) => {
  fireEvent.click(screen.getAllByRole("button", { name: /calendar/i })[picker]);

  const grid = await screen.findByRole("grid");
  const cell = Array.from(grid.querySelectorAll('[role="button"]')).find(
    (candidate) =>
      candidate.textContent === day &&
      !candidate.hasAttribute("data-outside-month"),
  );

  fireEvent.click(cell!);
};

const categoryTrigger = () => screen.getByRole("button", { name: /categor/i });
const currencyTrigger = () => screen.getByRole("button", { name: /moneda/i });
const statusTrigger = () => screen.getByRole("button", { name: /estado/i });

const pick = async (trigger: HTMLElement, name: string | RegExp) => {
  fireEvent.keyDown(trigger, { key: "ArrowDown" });

  const option = await screen.findByRole("option", { name });

  fireEvent.keyDown(option, { key: "Enter" });
  fireEvent.keyUp(option, { key: "Enter" });
};

describe("EntriesFilters while the select options are still loading", () => {
  const never = <T,>() => new Promise<T>(() => {});

  const renderLoading = (
    canClear = false,
    patch: Partial<EntriesQuery> = {},
  ) => {
    const onChange = vi.fn();
    const onClear = vi.fn();

    render(
      <EntriesFilters
        {...COPY}
        query={{ ...DEFAULT_ENTRIES_QUERY, ...patch }}
        categories={never()}
        currencies={never()}
        canClear={canClear}
        onChange={onChange}
        onClear={onClear}
      />,
    );

    return { onChange, onClear };
  };

  it("renders every label at once", () => {
    renderLoading();

    ["Desde", "Hasta", "Categoría", "Moneda", "Estado"].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it("shows a skeleton, instead of a select, only for the two that wait for data", () => {
    renderLoading();

    const group = screen.getByRole("group", { name: "Filtrar ingresos" });

    expect(group.querySelectorAll(".skeleton")).toHaveLength(2);
    expect(
      screen.queryByRole("button", { name: /categor/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /moneda/i }),
    ).not.toBeInTheDocument();
  });

  it("marks the waiting selects as busy", () => {
    renderLoading();

    const group = screen.getByRole("group", { name: "Filtrar ingresos" });

    expect(group.querySelectorAll('[aria-busy="true"]')).toHaveLength(2);
  });

  it("keeps the date pickers working while the selects wait", async () => {
    const { onChange } = renderLoading(false, { from: "2026-01-01" });

    expect(dateValue("from")).toBe("2026-01-01");

    await pickDay(0, "15");

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({ from: "2026-01-15" }),
    );
  });

  it("keeps Clear filters available, since it depends only on the URL", () => {
    const { onClear } = renderLoading(true);

    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("swaps the skeletons for the real selects once the options arrive", async () => {
    await act(async () => {
      render(
        <EntriesFilters
          {...COPY}
          query={DEFAULT_ENTRIES_QUERY}
          categories={Promise.resolve(CATEGORIES)}
          currencies={Promise.resolve(["ARS", "USD"])}
          canClear={false}
          onChange={() => {}}
          onClear={() => {}}
        />,
      );
    });

    expect(
      await screen.findByRole("button", { name: /categor/i }),
    ).toHaveTextContent("Todas las categorías");
    expect(
      await screen.findByRole("button", { name: /moneda/i }),
    ).toHaveTextContent("Todas las monedas");
    expect(
      screen
        .getByRole("group", { name: "Filtrar ingresos" })
        .querySelectorAll(".skeleton"),
    ).toHaveLength(0);
  });
});

describe("EntriesFilters", () => {
  it("shows every filter unset by default without a clear button", () => {
    renderFilters();

    expect(dateValue("from")).toBe("");
    expect(dateValue("to")).toBe("");
    expect(categoryTrigger()).toHaveTextContent("Todas las categorías");
    expect(currencyTrigger()).toHaveTextContent("Todas las monedas");
    expect(
      screen.queryByRole("button", { name: "Limpiar filtros" }),
    ).not.toBeInTheDocument();
  });

  it("reflects the active filters", () => {
    renderFilters({
      from: "2026-01-01",
      to: "2026-02-01",
      categoryId: "c2",
      currency: "USD",
    });

    expect(dateValue("from")).toBe("2026-01-01");
    expect(dateValue("to")).toBe("2026-02-01");
    expect(categoryTrigger()).toHaveTextContent("Salary");
    expect(currencyTrigger()).toHaveTextContent("USD");
  });

  it("shows a clear button only when a filter is active and reports the click", () => {
    const { onClear } = renderFilters({ currency: "USD" });

    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("follows the parent: no clear button when it says the state is already the default", () => {
    // Even with dates set, they may be the default range, where clearing would do nothing.
    renderFilters({ from: "2026-09-01", to: "2026-09-30" }, false);

    expect(
      screen.queryByRole("button", { name: "Limpiar filtros" }),
    ).not.toBeInTheDocument();
  });

  it("shows the clear button whenever the parent says the state is not the default", () => {
    renderFilters({ from: "2026-01-01", to: "2026-02-01" }, true);

    expect(
      screen.getByRole("button", { name: "Limpiar filtros" }),
    ).toBeInTheDocument();
  });

  it("reports the day picked in the From calendar", async () => {
    const { onChange } = renderFilters({ from: "2026-01-01" });

    await pickDay(0, "15");

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({ from: "2026-01-15" }),
    );
  });

  it("reports the day picked in the To calendar", async () => {
    const { onChange } = renderFilters({ to: "2026-03-01" });

    await pickDay(1, "31");

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({ to: "2026-03-31" }),
    );
  });

  it("offers all categories plus the user's and reports the choice", async () => {
    const { onChange } = renderFilters();

    await pick(categoryTrigger(), "Salary");

    expect(onChange).toHaveBeenCalledWith({ categoryId: "c2" });
  });

  it("reports choosing all categories as clearing the filter", async () => {
    const { onChange } = renderFilters({ categoryId: "c1" });

    await pick(categoryTrigger(), "Todas las categorías");

    expect(onChange).toHaveBeenCalledWith({ categoryId: null });
  });

  it("offers all currencies plus the ones in use and reports the choice", async () => {
    const { onChange } = renderFilters();

    await pick(currencyTrigger(), "USD");

    expect(onChange).toHaveBeenCalledWith({ currency: "USD" });
  });

  it("includes an active currency that is not among the ones in use", () => {
    renderFilters({ currency: "EUR" });

    expect(currencyTrigger()).toHaveTextContent("EUR");
  });

  it("reports choosing all currencies as clearing the filter", async () => {
    const { onChange } = renderFilters({ currency: "USD" });

    await pick(currencyTrigger(), "Todas las monedas");

    expect(onChange).toHaveBeenCalledWith({ currency: null });
  });
});

describe("EntriesFilters status filter", () => {
  it("offers every status plus the settled word it is given, and reports the choice", async () => {
    const { onChange } = renderFilters();

    fireEvent.keyDown(statusTrigger(), { key: "ArrowDown" });

    expect(
      await screen.findByRole("option", { name: "Todos los estados" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Listado" })).toBeInTheDocument();

    const settled = screen.getByRole("option", { name: "Cobrado" });

    fireEvent.keyDown(settled, { key: "Enter" });
    fireEvent.keyUp(settled, { key: "Enter" });

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({ status: "SETTLED" }),
    );
  });

  it("offers no 'covered' option unless it is given a word for it", async () => {
    renderFilters();

    fireEvent.keyDown(statusTrigger(), { key: "ArrowDown" });
    await screen.findByRole("option", { name: "Listado" });

    expect(
      screen.queryByRole("option", { name: "Cubierta" }),
    ).not.toBeInTheDocument();
  });

  it("offers the covered status, and reports it, when it is given a word for it", async () => {
    const onChange = vi.fn();

    render(
      <EntriesFilters
        {...COPY}
        coveredLabel="Cubierta"
        query={DEFAULT_ENTRIES_QUERY}
        categories={CATEGORIES}
        currencies={["ARS"]}
        canClear={false}
        onChange={onChange}
        onClear={() => {}}
      />,
    );

    await pick(statusTrigger(), "Cubierta");

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({ status: "COVERED" }),
    );
  });

  it("reflects an active covered status", () => {
    render(
      <EntriesFilters
        {...COPY}
        coveredLabel="Cubierta"
        query={{ ...DEFAULT_ENTRIES_QUERY, status: "COVERED" }}
        categories={CATEGORIES}
        currencies={["ARS"]}
        canClear
        onChange={() => {}}
        onClear={() => {}}
      />,
    );

    expect(statusTrigger()).toHaveTextContent("Cubierta");
  });

  it("reports choosing all statuses as clearing the filter", async () => {
    const { onChange } = renderFilters({ status: "PLANNED" });

    await pick(statusTrigger(), "Todos los estados");

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({ status: null }),
    );
  });

  it("reflects the active status", () => {
    renderFilters({ status: "PLANNED" });

    expect(statusTrigger()).toHaveTextContent("Listado");
  });

  it("is available at once, without waiting for any data", () => {
    render(
      <EntriesFilters
        {...COPY}
        query={DEFAULT_ENTRIES_QUERY}
        categories={new Promise(() => {})}
        currencies={new Promise(() => {})}
        canClear={false}
        onChange={() => {}}
        onClear={() => {}}
      />,
    );

    expect(statusTrigger()).toBeInTheDocument();
  });
});
