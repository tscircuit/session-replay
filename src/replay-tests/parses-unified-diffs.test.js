import { describe, expect, it } from "vitest";
import { buildReplay } from "../replay";

describe("session replay parser", () => {
  it("parses multi-file unified diffs including deletions", () => {
    const records = [
      {
        type: "custom_tool_call",
        name: "patch",
        input: [
          "--- /dev/null",
          "+++ b/one.txt",
          "@@ -0,0 +1 @@",
          "+one",
          "--- /dev/null",
          "+++ b/two.txt",
          "@@ -0,0 +1 @@",
          "+two",
        ].join("\n"),
      },
      {
        type: "custom_tool_call",
        name: "patch",
        input: ["--- a/one.txt", "+++ /dev/null", "@@ -1 +0,0 @@", "-one"].join("\n"),
      },
    ];
    const files = buildReplay(records).frames.at(-1).files;
    expect(files["one.txt"].deleted).toBe(true);
    expect(files["two.txt"].content).toBe("two");
  });
});
