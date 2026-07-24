import { describe, expect, it } from "vitest";
import { buildFileTree, fileBreadcrumbSegments } from "../replay-ui/ReplayPanels";

describe("workspace file tree", () => {
  it("builds nested folders from real file paths", () => {
    const files = {
      "package.json": { path: "package.json", status: "modified" },
      "src/ui/Button.jsx": { path: "src/ui/Button.jsx", status: "added" },
      "src/App.jsx": { path: "src/App.jsx", status: "modified" },
    };

    expect(buildFileTree(files).map(({ depth, kind, name, path }) => ({
      depth,
      kind,
      name,
      path,
    }))).toEqual([
      { depth: 0, kind: "folder", name: "src", path: "src" },
      { depth: 1, kind: "folder", name: "ui", path: "src/ui" },
      { depth: 2, kind: "file", name: "Button.jsx", path: "src/ui/Button.jsx" },
      { depth: 1, kind: "file", name: "App.jsx", path: "src/App.jsx" },
      { depth: 0, kind: "file", name: "package.json", path: "package.json" },
    ]);
    expect(fileBreadcrumbSegments("src/ui/Button.jsx")).toEqual(["src", "ui", "Button.jsx"]);

    const absoluteFiles = {
      "/home/ohmx/Documents/session-replay/server/session-tests/lists-sessions.test.js": {
        path: "/home/ohmx/Documents/session-replay/server/session-tests/lists-sessions.test.js",
        status: "modified",
      },
    };
    expect(buildFileTree(absoluteFiles).map(({ depth, kind, name, path }) => ({
      depth,
      kind,
      name,
      path,
    }))).toEqual([
      {
        depth: 0,
        kind: "folder",
        name: "home/ohmx/Documents/session-replay/server/session-tests",
        path: "home/ohmx/Documents/session-replay/server/session-tests",
      },
      {
        depth: 1,
        kind: "file",
        name: "lists-sessions.test.js",
        path: "/home/ohmx/Documents/session-replay/server/session-tests/lists-sessions.test.js",
      },
    ]);
  });
});
