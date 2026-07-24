import { describe, expect, it } from "vitest";
import { chooseWorkspaceFile } from "../replay-ui/ReplayPanels";

describe("workspace file selection", () => {
  it("keeps manual selection until the timeline frame changes", () => {
    const files = {
      "focused.js": { path: "focused.js" },
      "selected.js": { path: "selected.js" },
    };

    expect(chooseWorkspaceFile(files, "selected.js", "focused.js", false))
      .toBe("selected.js");
    expect(chooseWorkspaceFile(files, "selected.js", "focused.js", true))
      .toBe("focused.js");
  });
});
