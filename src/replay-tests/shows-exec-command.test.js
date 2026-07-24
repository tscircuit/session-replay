import { describe, expect, it } from "vitest";
import { buildReplay } from "../replay";

describe("session replay parser", () => {
  it("shows the command for exec tool aliases", () => {
    const replay = buildReplay([{
      type: "function_call",
      name: "exec",
      arguments: JSON.stringify({ command: "npm test && npm run build" }),
    }]);
    expect(replay.frames.at(-1).activities[0].label).toBe("npm test && npm run build");
  });
});
