import { expect, test } from "vitest";
import { buildReplay } from "../replay";
import {
  buildSessionAnalytics,
  buildToolAnalytics,
} from "../analytics/sessionAnalytics";

test("ranks tools, exact calls, reads, and edits from a replay", () => {
  const records = [
    {
      type: "session_meta",
      payload: { type: "session_meta", cwd: "/work/project" },
    },
    {
      type: "function_call",
      payload: {
        type: "function_call",
        name: "exec_command",
        arguments: JSON.stringify({ cmd: "sed -n '1,80p' src/App.jsx" }),
      },
    },
    {
      type: "function_call",
      payload: {
        type: "function_call",
        name: "exec_command",
        arguments: JSON.stringify({ cmd: "sed -n '1,80p' src/App.jsx" }),
      },
    },
    {
      type: "custom_tool_call",
      payload: {
        type: "custom_tool_call",
        name: "apply_patch",
        input: "*** Begin Patch\n*** Update File: src/App.jsx\n@@\n-old\n+new\n*** End Patch",
      },
    },
  ];

  const analytics = buildSessionAnalytics(buildReplay(records, "session.jsonl"));

  expect(analytics.toolRanking[0]).toMatchObject({ label: "exec_command", count: 2 });
  expect(analytics.exactCalls[0]).toMatchObject({ tool: "exec_command", count: 2 });
  expect(analytics.readFiles[0]).toMatchObject({ label: "src/App.jsx", count: 2 });
  expect(analytics.editedFiles[0]).toMatchObject({
    label: "src/App.jsx",
    count: 1,
    additions: 1,
    deletions: 1,
  });
  expect(buildToolAnalytics(buildReplay(records), "exec_command")).toMatchObject({
    uniqueInputs: 1,
    calls: [{ number: 1 }, { number: 2 }],
  });
});
