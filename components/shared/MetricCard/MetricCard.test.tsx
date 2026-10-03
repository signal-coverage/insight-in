// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MetricCard } from "./MetricCard";

const renderCard = (props: Parameters<typeof MetricCard>[0]) =>
  render(
    <ul>
      <MetricCard {...props} />
    </ul>,
  );

describe("MetricCard", () => {
  it("is a list item with its label and its value", () => {
    renderCard({ label: "Total ARS", value: "$ 1.000,00" });

    const item = screen.getByRole("listitem");

    expect(item).toHaveTextContent("Total ARS");
    expect(item).toHaveTextContent("$ 1.000,00");
  });

  it("shows a skeleton instead of the value while loading, and never a made-up amount", () => {
    const { container } = renderCard({ label: "Total", isLoading: true });

    expect(container.querySelector(".skeleton")).not.toBeNull();
    expect(screen.getByRole("listitem")).not.toHaveTextContent(/\d/);
  });

  it("ignores a value while loading", () => {
    renderCard({ label: "Total", value: "$ 1.000,00", isLoading: true });

    expect(screen.getByRole("listitem")).not.toHaveTextContent("$ 1.000,00");
  });

  it("is a plain card by default", () => {
    renderCard({ label: "Total", value: "1" });

    expect(screen.getByRole("listitem")).not.toHaveAttribute("data-emphasis");
  });

  it("can stand out from the other cards", () => {
    renderCard({
      label: "Remanente actual",
      value: "$ 700,00",
      emphasis: true,
    });

    expect(screen.getByRole("listitem")).toHaveAttribute(
      "data-emphasis",
      "true",
    );
  });
});

describe("MetricCard HeroUI card", () => {
  it("renders its figure inside a HeroUI card within the list item", () => {
    renderCard({ label: "Total", value: "$ 1,00", description: "Algo." });

    const item = screen.getByRole("listitem");
    const card = item.querySelector(".card");

    expect(card).not.toBeNull();
    expect(card?.parentElement).toBe(item);
    expect(card?.querySelector(".card__header")).toHaveTextContent("Total");
    expect(card?.querySelector(".card__content")).toHaveTextContent("$ 1,00");
    expect(card?.querySelector(".card__content")).toHaveTextContent("Algo.");
  });

  it("puts the tone and the emphasis on the card's ring", () => {
    renderCard({ label: "Total", value: "1", tone: "income" });
    renderCard({ label: "Neto", value: "1", emphasis: true });

    const [toned, emphasised] = screen
      .getAllByRole("listitem")
      .map((item) => item.querySelector(".card"));

    expect(toned).toHaveClass("bg-success-soft", "ring-success");
    expect(emphasised).toHaveClass("ring-2", "ring-accent");
  });

  it("does not add headings to the page", () => {
    renderCard({ label: "Total", value: "1" });

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});

describe("MetricCard tone and description", () => {
  it.each(["income", "expense"] as const)("can carry the %s tone", (tone) => {
    renderCard({ label: "Total", value: "1", tone });

    expect(screen.getByRole("listitem")).toHaveAttribute("data-tone", tone);
  });

  it("has no tone unless it is given one", () => {
    renderCard({ label: "Total", value: "1" });

    expect(screen.getByRole("listitem")).not.toHaveAttribute("data-tone");
  });

  it("keeps its tone while loading, so the row already reads as what it is", () => {
    renderCard({ label: "Total", isLoading: true, tone: "expense" });

    expect(screen.getByRole("listitem")).toHaveAttribute(
      "data-tone",
      "expense",
    );
  });

  it("explains itself with a description under the amount", () => {
    renderCard({
      label: "Actual",
      value: "$ 700,00",
      description: "Lo cobrado menos lo pagado.",
    });

    expect(screen.getByRole("listitem")).toHaveTextContent(
      "Lo cobrado menos lo pagado.",
    );
  });

  it("shows the description while loading too, since it carries no figure", () => {
    renderCard({
      label: "Actual",
      isLoading: true,
      description: "Lo cobrado menos lo pagado.",
    });

    expect(screen.getByRole("listitem")).toHaveTextContent(
      "Lo cobrado menos lo pagado.",
    );
  });
});
