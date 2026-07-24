const PATCH_NAMES = new Set(["apply_patch", "patch", "edit_file"]);

function safeJson(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function textFrom(value) {
  if (typeof value === "string") return value;
  if (!value) return "";
  if (Array.isArray(value)) return value.map(textFrom).filter(Boolean).join("\n");
  if (typeof value.text === "string") return value.text;
  if (typeof value.content === "string") return value.content;
  if (Array.isArray(value.content)) return textFrom(value.content);
  if (typeof value.input_text === "string") return value.input_text;
  if (typeof value.output_text === "string") return value.output_text;
  return "";
}

export function parseSessionText(raw) {
  const source = raw.trim();
  if (!source) throw new Error("The selected file is empty.");

  try {
    const parsed = JSON.parse(source);
    if (Array.isArray(parsed)) return parsed;
    for (const key of ["events", "items", "records", "session"]) {
      if (Array.isArray(parsed?.[key])) return parsed[key];
    }
    return [parsed];
  } catch {
    const records = [];
    const badLines = [];
    source.split(/\r?\n/).forEach((line, index) => {
      if (!line.trim()) return;
      try {
        records.push(JSON.parse(line));
      } catch {
        badLines.push(index + 1);
      }
    });
    if (!records.length) throw new Error("This does not look like JSON or JSONL.");
    if (badLines.length) {
      records.warnings = [`Skipped ${badLines.length} invalid JSONL line${badLines.length > 1 ? "s" : ""}.`];
    }
    return records;
  }
}

function normalizeRecord(record, index) {
  const payload = record?.payload ?? record?.item ?? record;
  const envelopeType = record?.type || "";
  const type = payload?.type || envelopeType || "event";
  const timestamp =
    record?.timestamp || payload?.timestamp || record?.created_at || payload?.created_at || null;

  if (type === "session_meta" || envelopeType === "session_meta") {
    return {
      kind: "meta",
      timestamp,
      data: payload,
      title: payload?.cwd ? payload.cwd.split("/").filter(Boolean).at(-1) : "LLM session",
      index,
    };
  }

  if (type === "user_message") {
    return {
      kind: "message",
      role: "user",
      text: textFrom(payload?.message ?? payload),
      source: envelopeType,
      timestamp,
      index,
    };
  }
  if (type === "agent_message") {
    return {
      kind: "message",
      role: "assistant",
      text: textFrom(payload?.message ?? payload),
      source: envelopeType,
      timestamp,
      index,
    };
  }
  if (type === "message") {
    const role = payload?.role;
    if (role !== "user" && role !== "assistant") return null;
    return {
      kind: "message",
      role,
      text: textFrom(payload),
      source: envelopeType,
      timestamp,
      index,
    };
  }

  const isTool =
    ["function_call", "custom_tool_call", "tool_call"].includes(type) ||
    Boolean(payload?.name && (payload?.arguments || payload?.input));
  if (isTool) {
    const name = payload?.name || payload?.tool_name || "tool";
    const rawInput = payload?.arguments ?? payload?.input ?? payload?.parameters ?? "";
    const input = safeJson(rawInput);
    const patch =
      PATCH_NAMES.has(name)
        ? typeof input === "string"
          ? input
          : input?.patch || input?.input || ""
        : "";
    return { kind: "tool", name, input, patch, callId: payload?.call_id, timestamp, index };
  }

  if (["function_call_output", "custom_tool_call_output", "tool_output"].includes(type)) {
    return {
      kind: "tool_output",
      text: textFrom(payload?.output ?? payload),
      callId: payload?.call_id,
      timestamp,
      index,
    };
  }

  if (type === "token_count") return { kind: "tokens", data: payload?.info || payload, timestamp, index };
  return null;
}

function parseApplyPatch(patch) {
  if (!patch || typeof patch !== "string") return [];
  const fileMarker = /^\*\*\* (Add|Update|Delete) File: (.+)$/gm;
  const markers = [...patch.matchAll(fileMarker)];
  if (!markers.length && /^(---|\+\+\+) /m.test(patch)) return parseUnifiedDiff(patch);

  return markers.map((match, i) => {
    const start = match.index + match[0].length;
    const end = markers[i + 1]?.index ?? patch.indexOf("*** End Patch", start);
    const body = patch.slice(start, end < 0 ? patch.length : end).replace(/^\r?\n/, "");
    const moveTo = body.match(/^\*\*\* Move to: (.+)$/m)?.[1]?.trim();
    return {
      action: match[1].toLowerCase(),
      path: moveTo || match[2].trim(),
      sourcePath: moveTo ? match[2].trim() : null,
      body: body.replace(/^\*\*\* Move to: .+\r?\n?/m, ""),
    };
  });
}

export function fileChangesFromRecord(record) {
  const event = normalizeRecord(record, 0);
  if (event?.kind !== "tool") return [];
  return parseApplyPatch(event.patch).map((change) => ({
    path: change.path,
    additions: (change.body.match(/^\+(?!\+\+)/gm) || []).length,
    deletions: (change.body.match(/^-(?!---)/gm) || []).length,
  }));
}

function parseUnifiedDiff(patch) {
  const files = [];
  const lines = patch.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].startsWith("--- ") || !lines[i + 1]?.startsWith("+++ ")) continue;
    const oldPath = diffPath(lines[i].slice(4), "a/");
    const newPath = diffPath(lines[i + 1].slice(4), "b/");
    const action = oldPath === "/dev/null" ? "add" : newPath === "/dev/null" ? "delete" : "update";
    const body = [];
    i += 2;
    while (
      i < lines.length &&
      !lines[i].startsWith("diff --git ") &&
      !(lines[i].startsWith("--- ") && lines[i + 1]?.startsWith("+++ "))
    ) {
      body.push(lines[i]);
      i += 1;
    }
    i -= 1;
    files.push({
      action,
      path: action === "delete" ? oldPath : newPath,
      sourcePath: null,
      body: body.join("\n"),
    });
  }
  return files;
}

function diffPath(value, prefix) {
  const path = value.split("\t", 1)[0].trim();
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

function findSubsequence(haystack, needle) {
  if (!needle.length) return 0;
  outer: for (let i = 0; i <= haystack.length - needle.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

function applyFilePatch(
  previous = "",
  change,
  previousKnown = Boolean(previous),
  previousApproximate = !previousKnown,
) {
  if (change.action === "delete") return { content: "", deleted: true, approximate: false };
  const bodyLines = change.body.split(/\r?\n/);
  if (change.action === "add") {
    return {
      content: bodyLines.filter((line) => line.startsWith("+")).map((line) => line.slice(1)).join("\n"),
      deleted: false,
      approximate: false,
    };
  }

  const original = previous ? previous.split("\n") : [];
  const hunks = [];
  let current = null;
  for (const line of bodyLines) {
    if (line.startsWith("@@")) {
      const header = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      current = {
        old: [],
        next: [],
        oldStart: Number(header?.[1] || 1),
        oldCount: Number(header?.[2] ?? 1),
        newStart: Number(header?.[3] || 1),
      };
      hunks.push(current);
    } else if (current && [" ", "+", "-"].includes(line[0])) {
      if (line[0] !== "+") current.old.push(line.slice(1));
      if (line[0] !== "-") current.next.push(line.slice(1));
    }
  }
  if (!hunks.length) {
    const reconstructed = bodyLines
      .filter((line) => line.startsWith("+") || line.startsWith(" "))
      .map((line) => line.slice(1))
      .join("\n");
    return { content: reconstructed || previous, deleted: false, approximate: previousApproximate };
  }

  let result = [...original];
  let approximate = previousApproximate;
  for (const hunk of hunks) {
    const position =
      hunk.old.length > 0
        ? findSubsequence(result, hunk.old)
        : Math.max(0, Math.min(result.length, hunk.newStart - 1));
    if (position >= 0) {
      result.splice(position, hunk.old.length, ...hunk.next);
    } else if (!previousKnown) {
      result.push(...hunk.next);
    } else {
      approximate = true;
      const fallback = Math.max(0, Math.min(result.length, hunk.newStart - 1));
      result.splice(fallback, hunk.old.length, ...hunk.next);
    }
  }
  return { content: result.join("\n"), deleted: false, approximate };
}

function cloneFiles(files) {
  return Object.fromEntries(Object.entries(files).map(([path, file]) => [path, { ...file }]));
}

function commandFromInput(input) {
  const value = typeof input === "object"
    ? input?.cmd ?? input?.command ?? input?.script ?? input?.input
    : input;
  if (Array.isArray(value)) return value.join(" ");
  return value ? String(value) : "";
}

function summarizeTool(event) {
  if (/(?:^|_)(?:exec|shell|command)(?:_|$)/.test(event.name)) {
    const command = commandFromInput(event.input);
    return command || "Command details unavailable";
  }
  if (PATCH_NAMES.has(event.name)) return "Applied a file patch";
  return event.name.replaceAll("_", " ");
}

export function buildReplay(records, filename = "session.jsonl") {
  const canonicalRoles = new Set(
    records.flatMap((record) => {
      if (record?.type !== "event_msg") return [];
      if (record?.payload?.type === "user_message") return ["user"];
      if (record?.payload?.type === "agent_message") return ["assistant"];
      return [];
    }),
  );
  const events = records
    .map(normalizeRecord)
    .filter(Boolean)
    .filter(
      (event) =>
        event.kind !== "message" ||
        event.source !== "response_item" ||
        !canonicalRoles.has(event.role),
    );
  const meta = events.find((event) => event.kind === "meta")?.data || {};
  const session = {
    title: meta.cwd?.split("/").filter(Boolean).at(-1) || filename.replace(/\.(jsonl?|txt)$/i, ""),
    cwd: meta.cwd || "",
    id: meta.id || meta.session_id || "",
    startedAt: meta.timestamp || events.find((event) => event.timestamp)?.timestamp || null,
    filename,
  };
  const frames = [];
  const messages = [];
  const activities = [];
  let files = {};
  let tokenData = null;

  events.forEach((event) => {
    let shouldFrame = false;
    let focusFile = null;

    if (event.kind === "message" && event.text) {
      messages.push({
        id: `message-${event.index}`,
        role: event.role,
        text: event.text,
        timestamp: event.timestamp,
      });
      shouldFrame = true;
    } else if (event.kind === "tool") {
      const changes = parseApplyPatch(event.patch);
      if (changes.length) {
        changes.forEach((change) => {
          const priorPath = change.sourcePath || change.path;
          const priorFile = files[priorPath];
          const prior = priorFile?.content || "";
          const applied = applyFilePatch(
            prior,
            change,
            Boolean(priorFile),
            priorFile?.approximate ?? !priorFile,
          );
          if (change.sourcePath && change.sourcePath !== change.path) {
            files[change.sourcePath] = {
              ...(files[change.sourcePath] || { path: change.sourcePath }),
              content: "",
              status: "deleted",
              deleted: true,
              approximate: false,
              additions: 0,
              deletions: 0,
              lastChangedAt: event.timestamp,
            };
          }
          files[change.path] = {
            path: change.path,
            content: applied.content,
            status:
              change.action === "add" ||
              (change.sourcePath && priorFile?.status === "added")
                ? "added"
                : change.action === "delete"
                  ? "deleted"
                  : "modified",
            deleted: applied.deleted,
            approximate: applied.approximate,
            additions: (change.body.match(/^\+(?!\+\+)/gm) || []).length,
            deletions: (change.body.match(/^-(?!---)/gm) || []).length,
            lastChangedAt: event.timestamp,
          };
          focusFile = change.path;
        });
      }
      activities.push({
        id: `activity-${event.index}`,
        name: event.name,
        label: summarizeTool(event),
        timestamp: event.timestamp,
        input: event.input,
        files: changes.map((change) => change.path),
      });
      shouldFrame = true;
    } else if (event.kind === "tokens") {
      tokenData = event.data;
      if (frames.length) frames.at(-1).tokenData = tokenData;
    }

    if (shouldFrame) {
      frames.push({
        id: `frame-${event.index}`,
        event,
        timestamp: event.timestamp,
        messages: messages.map((message) => ({ ...message })),
        activities: activities.map((activity) => ({ ...activity })),
        files: cloneFiles(files),
        focusFile,
        tokenData,
      });
    }
  });

  if (!frames.length) {
    frames.push({ id: "frame-empty", event: null, timestamp: session.startedAt, messages: [], activities: [], files: {}, tokenData });
  }

  return {
    session,
    frames,
    filePaths: Object.keys(files),
    stats: {
      turns: messages.filter((message) => message.role === "user").length,
      messages: messages.length,
      toolCalls: activities.length,
      files: Object.keys(files).length,
    },
    warnings: records.warnings || [],
  };
}

export function formatTime(value, fallback = "—") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export function timeDistance(start, end) {
  const from = new Date(start).getTime();
  const to = new Date(end).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return "";
  const total = Math.max(0, Math.floor((to - from) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
}
