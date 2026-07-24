import { describe, expect, it } from "vitest";
import { describeTimelineFrame, timelineScrollTarget } from "../replay-ui/Timeline";

describe("timeline event descriptions", () => {
  it("summarizes tool-driven file changes", () => {
    const frame = {
      event: { kind: "tool", name: "apply_patch" },
      activities: [{ label: "Applied a file patch", files: ["src/app.js", "src/main.js"] }],
      files: {
        "src/app.js": { additions: 4, deletions: 1 },
        "src/main.js": { additions: 2, deletions: 3 },
      },
    };

    expect(describeTimelineFrame(frame, 7)).toMatchObject({
      kind: "timeline-tool timeline-file-change",
      label: "apply patch",
      detail: "2 files · +6 −4 · app.js, main.js",
      title: "Event 7 · apply patch · 2 files · +6 −4 · app.js, main.js",
    });
    expect(timelineScrollTarget({
      clientWidth: 300,
      framesLength: 11,
      index: 5,
      scrollWidth: 900,
    })).toBe(300);
    expect(timelineScrollTarget({
      clientWidth: 300,
      framesLength: 11,
      index: 10,
      scrollWidth: 900,
    })).toBe(600);
  });
});
