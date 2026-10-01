// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { Component } from "react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { Await } from "./Await";

// What these tests can and cannot show: a promise that is STILL PENDING renders the fallback
// (checked here), and a promise that is already settled renders its result (checked here). The
// moment a pending promise settles AFTER mounting is not checked: jsdom never gets React to retry
// a suspended boundary (plain React `use()` + Suspense, with no Await involved, behaves the same
// in this environment). That transition is verified in the real browser instead.

const never = <T,>() => new Promise<T>(() => {});

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? <p>something broke</p> : this.props.children;
  }
}

describe("Await with a plain value", () => {
  it("renders its children right away, with no fallback", () => {
    render(
      <Await source={[1, 2]} fallback={<p>loading</p>}>
        {(items) => <p>{`count ${items.length}`}</p>}
      </Await>,
    );

    expect(screen.getByText("count 2")).toBeInTheDocument();
    expect(screen.queryByText("loading")).not.toBeInTheDocument();
  });

  it("treats a falsy value as a value, not as 'still loading'", () => {
    render(
      <Await source={0} fallback={<p>loading</p>}>
        {(value) => <p>{`value ${value}`}</p>}
      </Await>,
    );

    expect(screen.getByText("value 0")).toBeInTheDocument();
  });
});

describe("Await with a pending promise", () => {
  it("shows the fallback and not the children", () => {
    render(
      <Await source={never<string[]>()} fallback={<p>loading</p>}>
        {(items) => <p>{`got ${items.join(",")}`}</p>}
      </Await>,
    );

    expect(screen.getByText("loading")).toBeInTheDocument();
    expect(screen.queryByText(/^got/)).not.toBeInTheDocument();
  });

  it("lets every section wait on its own: only the pending ones show a fallback", () => {
    const shared = never<number>();

    render(
      <>
        <p>static header</p>
        <Await source={shared} fallback={<p>first loading</p>}>
          {(value) => <p>{`first ${value}`}</p>}
        </Await>
        <Await source={shared} fallback={<p>second loading</p>}>
          {(value) => <p>{`second ${value}`}</p>}
        </Await>
        <Await source="ready" fallback={<p>third loading</p>}>
          {(value) => <p>{`third ${value}`}</p>}
        </Await>
      </>,
    );

    // Everything around the waiting sections renders at once.
    expect(screen.getByText("static header")).toBeInTheDocument();
    expect(screen.getByText("first loading")).toBeInTheDocument();
    expect(screen.getByText("second loading")).toBeInTheDocument();
    expect(screen.getByText("third ready")).toBeInTheDocument();
    expect(screen.queryByText("third loading")).not.toBeInTheDocument();
  });
});

describe("Await with a settled promise", () => {
  it("renders the children with the resolved value", async () => {
    // Resolved before it renders, inside act: the case jsdom can actually drive.
    const data = Promise.resolve(["a", "b"]);

    await act(async () => {
      render(
        <Await source={data} fallback={<p>loading</p>}>
          {(items) => <p>{`got ${items.join(",")}`}</p>}
        </Await>,
      );
    });

    expect(await screen.findByText("got a,b")).toBeInTheDocument();
    expect(screen.queryByText("loading")).not.toBeInTheDocument();
  });

  it("hands a rejected promise to the nearest error boundary", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const failed = Promise.reject(new Error("boom"));

    // React reads the rejection itself; this only stops Node from calling it unhandled.
    failed.catch(() => {});

    await act(async () => {
      render(
        <Boundary>
          <Await source={failed} fallback={<p>loading</p>}>
            {(value: string) => <p>{value}</p>}
          </Await>
        </Boundary>,
      );
    });

    expect(await screen.findByText("something broke")).toBeInTheDocument();
    spy.mockRestore();
  });
});
