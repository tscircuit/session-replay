# LLM Replay

A local-first timeline viewer for LLM session JSON and JSONL files.

```bash
npm install
npm run dev
```

The local server automatically finds recent sessions in `~/.llm/sessions`, marks
the newest session for the current workspace, and makes the list searchable. You
can also drop in a session export or use the built-in demo. The viewer parses chat
messages, tool calls, and `apply_patch` events, then reconstructs the state of
changed files at every replay frame.

Static deployments fall back to six featured session exports in `public/sessions`.
The files are fetched on demand, so they do not increase the initial JavaScript
bundle.

Built with React, Vite, and Tailwind CSS v4.

## Notes

- Session files never leave your device.
- Local-session discovery is read-only and is available through the Vite dev and
  preview servers.
- Complete add-file patches are reconstructed exactly.
- Update patches are applied to earlier reconstructed states when possible. If the
  original file content is absent, the viewer clearly marks the result as partial.
- Shell commands are shown in the activity timeline but are not assumed to describe
  deterministic file mutations.
