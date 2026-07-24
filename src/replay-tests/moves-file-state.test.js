import { describe, expect, it } from "vitest";
import { buildReplay } from "../replay";

describe("session replay parser", () => {
  it("moves reconstructed file state to the new patch path", () => {
    const records = [
      {
        type: "custom_tool_call",
        name: "apply_patch",
        input: "*** Begin Patch\n*** Add File: old.txt\n+before\n*** End Patch",
      },
      {
        type: "custom_tool_call",
        name: "apply_patch",
        input: [
          "*** Begin Patch",
          "*** Update File: old.txt",
          "*** Move to: new.txt",
          "@@ -1 +1 @@",
          "-before",
          "+after",
          "*** End Patch",
        ].join("\n"),
      },
    ];
    const files = buildReplay(records).frames.at(-1).files;
    expect(files["old.txt"].deleted).toBe(true);
    expect(files["new.txt"].content).toBe("after");
  });
});
