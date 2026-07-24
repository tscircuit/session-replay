import { createReadStream } from "node:fs";
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileChangesFromRecord } from "../src/replay.js";

const SESSION_LIMIT = 75;

export function sessionRoot() {
  const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
  return path.join(codexHome, "sessions");
}

async function collectSessionFiles(directory, files = []) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "EACCES") return files;
    throw error;
  }

  await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectSessionFiles(entryPath, files);
    } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
      const details = await stat(entryPath);
      files.push({ path: entryPath, modifiedAt: details.mtime, size: details.size });
    }
  }));
  return files;
}

async function readSessionOverview(filePath) {
  const input = createReadStream(filePath, { encoding: "utf8" });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  let record = null;
  const changedFiles = new Set();
  let additions = 0;
  let deletions = 0;
  try {
    for await (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        record ||= parsed;
        fileChangesFromRecord(parsed).forEach((change) => {
          changedFiles.add(change.path);
          additions += change.additions;
          deletions += change.deletions;
        });
      } catch {
        // Invalid records are ignored in the same way as the replay parser.
      }
    }
  } finally {
    lines.close();
    input.destroy();
  }
  return {
    record,
    changeStats: { additions, deletions, files: changedFiles.size },
  };
}

function sessionMetadata(file, root, overview) {
  const { record, changeStats } = overview;
  const payload = record?.payload || {};
  const cwd = payload.cwd || "";
  return {
    path: path.relative(root, file.path),
    filename: path.basename(file.path),
    id: payload.id || payload.session_id || "",
    cwd,
    title: path.basename(cwd) || "Codex session",
    startedAt: payload.timestamp || record?.timestamp || file.modifiedAt.toISOString(),
    modifiedAt: file.modifiedAt.toISOString(),
    size: file.size,
    changeStats,
  };
}

export async function listSessions({
  root = sessionRoot(),
  currentWorkspace = process.cwd(),
  limit = SESSION_LIMIT,
} = {}) {
  const files = await collectSessionFiles(root);
  files.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());

  const sessions = await Promise.all(
    files.slice(0, limit).map(async (file) =>
      sessionMetadata(file, root, await readSessionOverview(file.path))),
  );
  const normalizedWorkspace = path.resolve(currentWorkspace);
  const currentIndex = sessions.findIndex(
    (session) => session.cwd && path.resolve(session.cwd) === normalizedWorkspace,
  );

  if (currentIndex >= 0) {
    sessions[currentIndex] = { ...sessions[currentIndex], current: true };
    const [current] = sessions.splice(currentIndex, 1);
    sessions.unshift(current);
  }

  return sessions;
}

export async function readSession(relativePath, { root = sessionRoot() } = {}) {
  if (!relativePath || path.isAbsolute(relativePath) || !relativePath.endsWith(".jsonl")) {
    const error = new Error("Invalid session path.");
    error.statusCode = 400;
    throw error;
  }

  let canonicalRoot;
  let canonicalFile;
  try {
    [canonicalRoot, canonicalFile] = await Promise.all([
      realpath(root),
      realpath(path.resolve(root, relativePath)),
    ]);
  } catch {
    const error = new Error("Session not found.");
    error.statusCode = 404;
    throw error;
  }

  if (!canonicalFile.startsWith(`${canonicalRoot}${path.sep}`)) {
    const error = new Error("Invalid session path.");
    error.statusCode = 400;
    throw error;
  }
  return readFile(canonicalFile, "utf8");
}

function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
}

export function localSessionsPlugin() {
  const middleware = async (request, response, next) => {
    const url = new URL(request.url || "/", "http://localhost");
    if (request.method === "GET" && url.pathname === "/api/sessions") {
      try {
        sendJson(response, 200, { sessions: await listSessions() });
      } catch (error) {
        sendJson(response, 500, { error: error?.message || "Could not find local sessions." });
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/session") {
      try {
        const content = await readSession(url.searchParams.get("path"));
        response.statusCode = 200;
        response.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");
        response.end(content);
      } catch (error) {
        sendJson(response, error?.statusCode || 500, {
          error: error?.message || "Could not open that session.",
        });
      }
      return;
    }
    next();
  };

  return {
    name: "codex-local-sessions",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
