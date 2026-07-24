const READ_COMMAND = /(?:^|\s)(?:\S*\/)?(?:bat|cat|head|less|more|rg|sed|tail)\b/;
const READ_TOOLS = /(?:read|open|view|search|find)/i;
const PATH_KEYS = new Set(["file", "file_path", "filepath", "filename", "path", "paths"]);

function commandFromInput(input) {
  const value = typeof input === "object"
    ? input?.cmd ?? input?.command ?? input?.script
    : input;
  if (Array.isArray(value)) return value.join(" ");
  return typeof value === "string" ? value : "";
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .filter((key) => !["max_output_tokens", "yield_time_ms"].includes(key))
      .map((key) => [key, stableValue(value[key])]),
  );
}

function inputLabel(activity) {
  const command = commandFromInput(activity.input).replace(/\s+/g, " ").trim();
  if (command) return command;
  if (activity.changes?.length) {
    return activity.changes.map((change) => change.path).sort().join(", ");
  }
  if (typeof activity.input === "string") return activity.input.replace(/\s+/g, " ").trim();
  if (activity.input && typeof activity.input === "object") {
    return JSON.stringify(stableValue(activity.input));
  }
  return activity.label || activity.name;
}

function ranked(entries, limit) {
  return [...entries]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function addCount(map, key, extra = {}) {
  if (!key) return;
  const current = map.get(key) || { label: key, count: 0 };
  map.set(key, {
    ...current,
    ...extra,
    count: current.count + 1,
    additions: (current.additions || 0) + (extra.additions || 0),
    deletions: (current.deletions || 0) + (extra.deletions || 0),
  });
}

function normalizePath(path, cwd) {
  const clean = path
    .replace(/^["']|["']$/g, "")
    .replace(/[),;:]$/g, "");
  if (cwd && clean.startsWith(`${cwd}/`)) return clean.slice(cwd.length + 1);
  return clean.replace(/^\.\//, "");
}

function pathValues(value, key = "") {
  if (Array.isArray(value)) return value.flatMap((item) => pathValues(item, key));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([childKey, child]) => pathValues(child, childKey));
  }
  if (PATH_KEYS.has(key.toLowerCase()) && typeof value === "string") return [value];
  return [];
}

function commandReadPaths(command) {
  const paths = [];
  const pathPattern = /(?:^|\s)(["']?)(\/?[\w.@+-]+(?:\/[\w.@+-]+)*\.[A-Za-z0-9]+)\1(?=\s|$|[;,)])/g;
  command.split(/&&|\|\||;|\n/).forEach((part) => {
    const segment = part.trim();
    if (!READ_COMMAND.test(segment) || /\brg\s+--files\b/.test(segment)) return;
    for (const match of segment.matchAll(pathPattern)) paths.push(match[2]);
  });
  return paths;
}

function readPaths(activity, cwd) {
  const command = commandFromInput(activity.input);
  const paths = command ? commandReadPaths(command) : [];
  if (READ_TOOLS.test(activity.name)) paths.push(...pathValues(activity.input));
  return [...new Set(paths.map((path) => normalizePath(path, cwd)).filter(Boolean))];
}

function collapseAbsolutePaths(map) {
  const relative = [...map.keys()].filter((path) => !path.startsWith("/"));
  [...map.entries()].forEach(([path, item]) => {
    if (!path.startsWith("/")) return;
    const match = relative
      .filter((candidate) => path.endsWith(`/${candidate}`))
      .sort((a, b) => b.length - a.length)[0];
    if (!match) return;
    const target = map.get(match);
    map.set(match, {
      ...target,
      count: target.count + item.count,
      additions: (target.additions || 0) + (item.additions || 0),
      deletions: (target.deletions || 0) + (item.deletions || 0),
    });
    map.delete(path);
  });
}

function tokenTotal(frame) {
  return frame?.tokenData?.total_token_usage?.total_tokens
    ?? frame?.tokenData?.total_tokens
    ?? null;
}

export function buildSessionAnalytics(replay) {
  const activities = replay.frames.at(-1)?.activities || [];
  const tools = new Map();
  const exact = new Map();
  const reads = new Map();
  const edits = new Map();

  activities.forEach((activity) => {
    addCount(tools, activity.name);
    const detail = inputLabel(activity);
    const exactKey = `${activity.name}\u0000${detail}`;
    addCount(exact, exactKey, { label: detail, tool: activity.name });
    readPaths(activity, replay.session.cwd).forEach((path) => addCount(reads, path));
    activity.changes?.forEach((change) => {
      addCount(edits, normalizePath(change.path, replay.session.cwd), {
        additions: change.additions || 0,
        deletions: change.deletions || 0,
      });
    });
  });

  collapseAbsolutePaths(reads);
  collapseAbsolutePaths(edits);
  const toolRanking = ranked(tools.values(), 8);
  const exactCalls = ranked(exact.values(), 7);
  const readFiles = ranked(reads.values(), 7);
  const editedFiles = ranked(edits.values(), 7);
  const additions = [...edits.values()].reduce((sum, item) => sum + item.additions, 0);
  const deletions = [...edits.values()].reduce((sum, item) => sum + item.deletions, 0);
  const exactRepeats = [...exact.values()]
    .reduce((sum, item) => sum + Math.max(0, item.count - 1), 0);

  return {
    toolRanking,
    exactCalls,
    readFiles,
    editedFiles,
    totals: {
      additions,
      deletions,
      tokens: tokenTotal(replay.frames.at(-1)),
      uniqueTools: tools.size,
      uniqueReads: reads.size,
      editedFiles: edits.size,
      exactRepeats,
    },
  };
}

function formattedInput(input) {
  if (typeof input === "string") return input;
  if (input === undefined || input === null) return "No input payload recorded.";
  return JSON.stringify(input, null, 2);
}

export function buildToolAnalytics(replay, toolName) {
  const activities = (replay.frames.at(-1)?.activities || [])
    .filter((activity) => activity.name === toolName);
  const commonMap = new Map();
  const fileMap = new Map();

  const calls = activities.map((activity, index) => {
    const label = inputLabel(activity);
    addCount(commonMap, label);
    const files = [...new Set([
      ...(activity.files || []),
      ...readPaths(activity, replay.session.cwd),
    ].map((path) => normalizePath(path, replay.session.cwd)))];
    files.forEach((path) => addCount(fileMap, path));
    return {
      id: activity.id,
      number: index + 1,
      timestamp: activity.timestamp,
      label,
      payload: formattedInput(activity.input),
      files,
    };
  });

  collapseAbsolutePaths(fileMap);
  return {
    calls,
    commonInputs: ranked(commonMap.values(), 8),
    touchedFiles: ranked(fileMap.values(), 8),
    uniqueInputs: commonMap.size,
  };
}
