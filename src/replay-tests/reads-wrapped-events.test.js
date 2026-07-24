import { describe, expect, it } from "vitest";
import { buildReplay, parseSessionText } from "../replay";

describe("session replay parser", () => {
  it("reads object-wrapped event arrays", () => {
    const records = parseSessionText(JSON.stringify({ events: [{ type: "message", role: "assistant", content: "done" }] }));
    expect(buildReplay(records).stats.messages).toBe(1);
  });
});
