import { describe, expect, it } from "vitest";
import { buildReplay } from "../replay";

describe("session replay parser", () => {
  it("uses each hunk location when context is unavailable", () => {
    const records = [{
      type: "custom_tool_call",
      name: "apply_patch",
      input: [
        "*** Begin Patch",
        "*** Add File: a.txt",
        "+one",
        "+two",
        "+three",
        "+four",
        "*** Update File: a.txt",
        "@@ -1 +1 @@",
        "-missing",
        "+ONE",
        "@@ -4 +4 @@",
        "-also-missing",
        "+FOUR",
        "*** End Patch",
      ].join("\n"),
    }];
    expect(buildReplay(records).frames.at(-1).files["a.txt"].content).toBe("ONE\ntwo\nthree\nFOUR");
  });
});
