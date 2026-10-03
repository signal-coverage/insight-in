// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CardTier } from "@/core/cards/types";

import { TierChip } from "./TierChip";

const MEANINGS: Readonly<Record<CardTier, string>> = {
  available: "Disponible: usás hasta el 80% del tope",
  near: "Cerca del tope: usás entre el 80% y el 100%",
  exceeded: "Excedida: pasaste el tope",
};

const WORDS: Readonly<Record<CardTier, string>> = {
  available: "Disponible",
  near: "Cerca del tope",
  exceeded: "Excedida",
};

const TIERS: readonly CardTier[] = ["available", "near", "exceeded"];

// The tab stop that wraps the chip.
const trigger = (tier: CardTier): HTMLElement => {
  const element = screen
    .getByText(WORDS[tier])
    .closest<HTMLElement>("[tabindex]");

  if (!element) throw new Error(`The ${tier} chip has no tab stop`);

  return element;
};

describe("TierChip", () => {
  it.each(TIERS)("says the %s tier in words", (tier) => {
    render(<TierChip tier={tier} />);

    expect(screen.getByText(WORDS[tier])).toBeInTheDocument();
  });

  it.each(TIERS)(
    "explains the %s tier in a tooltip on keyboard focus",
    (tier) => {
      render(<TierChip tier={tier} />);

      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

      fireEvent.keyDown(document.body, { key: "Tab" });
      act(() => trigger(tier).focus());

      expect(screen.getByRole("tooltip")).toHaveTextContent(MEANINGS[tier]);
    },
  );

  it.each(TIERS)("explains the %s tier in a tooltip on hover", (tier) => {
    vi.useFakeTimers();

    try {
      render(<TierChip tier={tier} />);

      // A real mouse moves before it enters: that is what tells React Aria it is the pointer.
      fireEvent.pointerMove(document.body, { pointerType: "mouse" });
      fireEvent.pointerEnter(trigger(tier), { pointerType: "mouse" });
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(screen.getByRole("tooltip")).toHaveTextContent(MEANINGS[tier]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the icon decorative: the words next to it are its name", () => {
    render(<TierChip tier="near" />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
