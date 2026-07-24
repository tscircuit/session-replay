import { describe, expect, it } from "vitest";
import { buildReplay } from "../replay";

describe("session replay parser", () => {
  it("keeps the latest token count on the current frame", () => {
    const replay = buildReplay([
      { type: "event_msg", payload: { type: "user_message", message: "hello" } },
      { type: "event_msg", payload: { type: "token_count", info: { total_token_usage: { total_tokens: 12 } } } },
    ]);
    expect(replay.frames.at(-1).tokenData.total_token_usage.total_tokens).toBe(12);
  });
});
