import { describe, expect, it } from "vitest";
import { buildReplay } from "../replay";

describe("session replay parser", () => {
  it("uses canonical LLM messages without response-item duplicates or injected roles", () => {
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
});
