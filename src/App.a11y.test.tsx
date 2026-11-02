import { render } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it } from "vite-plus/test";
import { App } from "./App.tsx";

describe("App accessibility (axe, jsdom)", () => {
  it("has no serious or critical axe violations on the initial screen", async () => {
    const { container } = render(<App />);
    const results = await axe.run(container, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
    });
    const blocking = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(blocking.map((violation) => violation.id)).toEqual([]);
  });
});
