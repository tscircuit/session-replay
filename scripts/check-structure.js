import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const MAX_LINES = 500;
const MAX_FILES = 10;
const SKIPPED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".turbo",
  ".vite",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
]);
const GENERATED_FILES = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
]);
const GENERATED_DIRECTORIES = new Set([
  path.join("public", "sessions"),
]);

const failures = [];

function relative(filePath) {
  return path.relative(ROOT, filePath) || ".";
}

function countLines(content) {
  if (!content.length) return 0;
  return content.split(/\r\n|\r|\n/).length - (content.endsWith("\n") ? 1 : 0);
}

async function checkTextFile(filePath) {
  if (GENERATED_FILES.has(path.basename(filePath))) return;

  const content = await readFile(filePath);
  if (content.includes(0)) return;

  const lineCount = countLines(content.toString("utf8"));
  if (lineCount > MAX_LINES) {
    failures.push(`${relative(filePath)} has ${lineCount} lines (maximum ${MAX_LINES})`);
  }
}

async function visit(directory) {
  if (GENERATED_DIRECTORIES.has(relative(directory))) return;
  const entries = await readdir(directory, { withFileTypes: true });
  const files = entries.filter(
    (entry) => entry.isFile() && !GENERATED_FILES.has(entry.name),
  );

  if (files.length > MAX_FILES) {
    failures.push(
      `${relative(directory)} contains ${files.length} direct files (maximum ${MAX_FILES})`,
    );
  }

  await Promise.all(files.map((entry) => checkTextFile(path.join(directory, entry.name))));
  await Promise.all(
    entries
      .filter(
        (entry) => entry.isDirectory() && !SKIPPED_DIRECTORIES.has(entry.name),
      )
      .map((entry) => visit(path.join(directory, entry.name))),
  );
}

await visit(ROOT);

if (failures.length) {
  console.error("Architecture checks failed:\n");
  failures.sort().forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log("Architecture checks passed.");
}
