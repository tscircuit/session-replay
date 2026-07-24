import { describe, expect, it } from "vitest";
import { buildReplay, parseSessionText } from "./replay";

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

  it("reads object-wrapped event arrays", () => {
    const records = parseSessionText(JSON.stringify({ events: [{ type: "message", role: "assistant", content: "done" }] }));
    expect(buildReplay(records).stats.messages).toBe(1);
  });

  it("uses canonical Codex messages without response-item duplicates or injected roles", () => {
    const records = [
      { type: "response_item", payload: { type: "message", role: "developer", content: [{ text: "hidden" }] } },
      { type: "response_item", payload: { type: "message", role: "user", content: [{ text: "hello" }] } },
      { type: "event_msg", payload: { type: "user_message", message: "hello" } },
      { type: "event_msg", payload: { type: "agent_message", message: "hi" } },
      { type: "response_item", payload: { type: "message", role: "assistant", content: [{ text: "hi" }] } },
    ];
    const replay = buildReplay(records);
    expect(replay.frames.at(-1).messages.map(({ role, text }) => ({ role, text }))).toEqual([
      { role: "user", text: "hello" },
      { role: "assistant", text: "hi" },
    ]);
  });

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

  it("keeps the latest token count on the current frame", () => {
    const replay = buildReplay([
      { type: "event_msg", payload: { type: "user_message", message: "hello" } },
      { type: "event_msg", payload: { type: "token_count", info: { total_token_usage: { total_tokens: 12 } } } },
    ]);
    expect(replay.frames.at(-1).tokenData.total_token_usage.total_tokens).toBe(12);
  });
});
