import { describe, expect, it } from "vitest";
import { isVisibleActivity } from "../replay-ui/ReplayPanels";

describe("conversation tool cards", () => {
  it("hides write_stdin continuation cards", () => {
    expect(isVisibleActivity({ name: "write_stdin" })).toBe(false);
    expect(isVisibleActivity({ name: "exec_command" })).toBe(true);
  });
});
