import { describe, expect, it } from "vitest";
import { buildReplay } from "../replay";

describe("session replay parser", () => {
  it("applies successive update hunks without inventing trailing blank lines", () => {
    const records = [
      {
        type: "custom_tool_call",
        name: "apply_patch",
        input: "*** Begin Patch\n*** Add File: a.txt\n+one\n+two\n+three\n*** End Patch",
      },
      {
        type: "custom_tool_call",
        name: "apply_patch",
        input: "*** Begin Patch\n*** Update File: a.txt\n@@ -1,3 +1,3 @@\n one\n-two\n+TWO\n three\n*** End Patch",
      },
    ];
    const file = buildReplay(records).frames.at(-1).files["a.txt"];
    expect(file.content).toBe("one\nTWO\nthree");
    expect(file.approximate).toBe(false);
  });
});
