# Repository Rules

These rules apply to every change in this repository.

## File size

- Keep every authored text file at or below 500 physical lines, including comments
  and blank lines.
- Split a file before adding code that would cross the limit. Prefer cohesive,
  domain-named modules over numbered fragments.
- Generated output, installed dependencies, caches, and generated lockfiles are
  exempt. Do not hand-edit those files to satisfy a limit.

## Classes

- A source file may declare at most one class.
- Put each additional class in its own file and name the file after the class.
- Helper functions and small constants may remain beside the class when they are
  tightly coupled and the file stays within the line limit.

## Tests

- A test file may declare exactly one `it(...)` or `test(...)` case.
- Hooks, fixtures, and helpers may share that file when they serve its single test.
- Put related test files in a dedicated subfolder rather than accumulating them
  beside production modules.

## Folder size

- Keep at most 10 direct files in any authored folder. Nested files do not count
  toward the parent folder's total.
- When a folder reaches 10 files, create a cohesive, descriptively named subfolder
  before adding another file.
- Generated directories such as `dist`, `coverage`, caches, dependencies, and
  version-control metadata are outside this limit.

## Enforcement

- Run `npm run check` before handing off a change.
- ESLint enforces the JavaScript/JSX line limit, one-class limit, and one-test
  limit. `npm run check:structure` covers all authored text files and folder counts.
- Do not disable or weaken these rules to make a change pass. Refactor the affected
  code instead. Any necessary exception requires explicit user approval and must be
  narrowly documented.
