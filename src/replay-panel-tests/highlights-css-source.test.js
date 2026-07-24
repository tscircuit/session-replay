import { describe, expect, it } from "vitest";
import { highlightSource } from "../replay-ui/sourceHighlight";

describe("source highlighting", () => {
  it("adds tree-sitter token classes to css source", async () => {
    const lines = await highlightSource("demo.css", ".activity-card { color: red; }");
    expect(lines.flat().map((segment) => segment.className)).toContain("syntax-class");
    expect(lines.flat().map((segment) => segment.className)).toContain("syntax-property");
  });
});
