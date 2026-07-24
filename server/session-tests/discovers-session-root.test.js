import { mkdtemp, mkdir, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { listSessions } from "../sessions";

let temporaryDirectory;

afterEach(async () => {
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { recursive: true, force: true });
    temporaryDirectory = "";
  }
});

describe("local session discovery", () => {
  it("uses the hidden session store containing the newest session", async () => {
    temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "llm-roots-"));
    const olderRoot = path.join(temporaryDirectory, ".older", "sessions");
    const newerRoot = path.join(temporaryDirectory, ".newer", "sessions");
    await Promise.all([
      mkdir(olderRoot, { recursive: true }),
      mkdir(newerRoot, { recursive: true }),
    ]);
    const olderFile = path.join(olderRoot, "older.jsonl");
    const newerFile = path.join(newerRoot, "newer.jsonl");
    await Promise.all([
      writeFile(olderFile, "{\"payload\":{\"id\":\"older\"}}\n"),
      writeFile(newerFile, "{\"payload\":{\"id\":\"newer\"}}\n"),
    ]);
    await utimes(olderFile, new Date("2026-01-01"), new Date("2026-01-01"));
    await utimes(newerFile, new Date("2026-02-01"), new Date("2026-02-01"));

    const sessions = await listSessions({ homeDirectory: temporaryDirectory });

    expect(sessions.map((session) => session.id)).toEqual(["newer"]);
  });
});
