// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BlockError } from "./BlockError";

describe("BlockError", () => {
  it("says the block could not be loaded, as an alert", () => {
    render(<BlockError retryHref="/dashboard/overview?currency=USD" />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "No pudimos cargar esto.",
    );
  });

  it("offers to try again on the same address", () => {
    render(<BlockError retryHref="/dashboard/overview?currency=USD" />);

    expect(screen.getByRole("link", { name: "Reintentar" })).toHaveAttribute(
      "href",
      "/dashboard/overview?currency=USD",
    );
  });
});
