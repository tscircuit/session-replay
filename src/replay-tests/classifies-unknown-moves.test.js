import { describe, expect, it } from "vitest";
import { buildReplay } from "../replay";

describe("session replay parser", () => {
  it("classifies a move without source state as an approximate modification", () => {
    const records = [{
      type: "custom_tool_call",
      name: "apply_patch",
      input: [
        "*** Begin Patch",
        "*** Update File: existing.txt",
        "*** Move to: nested/existing.txt",
        "@@ -1 +1 @@",
        "-before",
        "+after",
        "*** End Patch",
      ].join("\n"),
    }];

    const files = buildReplay(records).frames.at(-1).files;

    expect(files["existing.txt"].deleted).toBe(true);
    expect(files["nested/existing.txt"]).toMatchObject({
      content: "after",
      status: "modified",
      approximate: true,
    });
  });
});
