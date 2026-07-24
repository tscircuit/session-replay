import { describe, expect, it } from "vitest";
import { buildReplay, parseSessionText } from "../replay";

describe("session replay parser", () => {
  it("reads JSONL and reconstructs added files", () => {
    const records = parseSessionText([
      JSON.stringify({ type: "event_msg", payload: { type: "user_message", message: "hello" } }),
      JSON.stringify({
        type: "response_item",
        payload: {
          type: "custom_tool_call",
          name: "apply_patch",
          input: "*** Begin Patch\n*** Add File: hello.js\n+console.log('hi')\n*** End Patch",
        },
      }),
    ].join("\n"));
    const replay = buildReplay(records, "test.jsonl");
    expect(replay.stats.turns).toBe(1);
    expect(replay.frames.at(-1).files["hello.js"].content).toBe("console.log('hi')");
  });
});
