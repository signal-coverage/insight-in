// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { useIsHydrated } from "./useIsHydrated";

function Probe() {
  return <span>{useIsHydrated() ? "client" : "server"}</span>;
}

describe("useIsHydrated", () => {
  it("is false when rendered on the server", () => {
    expect(renderToString(<Probe />)).toContain("server");
  });

  it("is true once rendered in the browser", () => {
    render(<Probe />);

    expect(screen.getByText("client")).toBeInTheDocument();
  });
});
