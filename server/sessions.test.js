import { mkdtemp, mkdir, rm, symlink, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { listSessions, readSession } from "./sessions";

const temporaryDirectories = [];

async function temporaryDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-replay-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })));
});

describe("local session discovery", () => {
  it("lists the newest sessions and promotes the current workspace", async () => {
    const root = await temporaryDirectory();
    const dated = path.join(root, "2026", "07", "24");
    await mkdir(dated, { recursive: true });
    const other = path.join(dated, "other.jsonl");
    const current = path.join(dated, "current.jsonl");
    await writeFile(other, `${JSON.stringify({
      type: "session_meta",
      payload: { id: "other-id", cwd: "/workspace/other", timestamp: "2026-07-24T01:00:00Z" },
    })}\n`);
    await writeFile(current, `${JSON.stringify({
      type: "session_meta",
      payload: { id: "current-id", cwd: "/workspace/current", timestamp: "2026-07-24T00:00:00Z" },
    })}\n`);
    await utimes(current, new Date("2026-07-24T00:00:00Z"), new Date("2026-07-24T00:00:00Z"));
    await utimes(other, new Date("2026-07-24T02:00:00Z"), new Date("2026-07-24T02:00:00Z"));

    const sessions = await listSessions({ root, currentWorkspace: "/workspace/current" });

    expect(sessions.map((session) => session.id)).toEqual(["current-id", "other-id"]);
    expect(sessions[0]).toMatchObject({ current: true, title: "current" });
  });

  it("reads listed files but rejects traversal and escaping symlinks", async () => {
    const container = await temporaryDirectory();
    const root = path.join(container, "sessions");
    const outside = path.join(container, "outside.jsonl");
    await mkdir(root);
    await writeFile(path.join(root, "session.jsonl"), "{\"type\":\"session_meta\"}\n");
    await writeFile(outside, "private");
    await symlink(outside, path.join(root, "link.jsonl"));

    await expect(readSession("session.jsonl", { root })).resolves.toContain("session_meta");
    await expect(readSession("../outside.jsonl", { root })).rejects.toThrow("Invalid session path");
    await expect(readSession("link.jsonl", { root })).rejects.toThrow("Invalid session path");
  });
});
