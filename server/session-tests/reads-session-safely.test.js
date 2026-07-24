import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readSession } from "../sessions";

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
