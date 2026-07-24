import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  File,
  FileCode2,
  FileJson,
  FilePlus2,
  Folder,
  FolderOpen,
  Info,
  MessageSquareText,
  PanelLeftClose,
  PanelRightClose,
  Search,
  Terminal,
  UserRound,
  Zap,
} from "lucide-react";
import { Mark } from "../ui/Mark";
import { ResizeHandle } from "../ui/ResizeHandle";

function formatElapsedTimestamp(start, value) {
  const from = new Date(start).getTime();
  const to = new Date(value).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return "00";
  const totalSeconds = Math.max(0, Math.floor((to - from) / 1000));
  if (totalSeconds < 60) return String(totalSeconds).padStart(2, "0");
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function Message({ message, startedAt }) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const author = isUser ? "You" : isAssistant ? "Codex" : "System";
  return (
    <article className={`message ${isUser ? "user-message" : "assistant-message"}`}>
      <div className="avatar">{isUser ? <UserRound size={15} /> : isAssistant ? <Mark /> : <Bot size={15} />}</div>
      <div className="message-body">
        <div className="message-meta">
          <strong>{author}</strong>
          <time>{formatElapsedTimestamp(startedAt, message.timestamp)}</time>
        </div>
        <p>{message.text}</p>
      </div>
    </article>
  );
}

function Activity({ activity }) {
  const command = /(?:^|_)(?:exec|shell|command)(?:_|$)/.test(activity.name);
  const title = command
    ? "Ran command"
    : activity.files.length
      ? "Changed files"
      : activity.name.replaceAll("_", " ");
  const details = command
    ? [activity.label]
    : activity.files.length
      ? activity.files
      : activity.label !== title
        ? [activity.label]
        : [];

  return (
    <div className="activity">
      <div className="activity-icon">{command ? <Terminal size={14} /> : <Code2 size={14} />}</div>
      <div className="activity-copy">
        <div className="activity-heading">
          <strong>{title}</strong>
          <Check size={14} className="activity-check" />
        </div>
        {details.map((detail, index) => <code key={`${detail}-${index}`}>{detail}</code>)}
      </div>
    </div>
  );
}

export function ChatPanel({ frame, startedAt, allActivities, collapsed, onToggle }) {
  const scrollRef = useRef(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [frame.id]);

  const feed = useMemo(() => {
    const items = [
      ...frame.messages.map((item) => ({ ...item, _kind: "message" })),
      ...frame.activities.map((item) => ({ ...item, _kind: "activity" })),
    ];
    return items.sort((a, b) => {
      const ta = new Date(a.timestamp || 0).getTime();
      const tb = new Date(b.timestamp || 0).getTime();
      return ta - tb || a.id.localeCompare(b.id);
    });
  }, [frame]);

  if (collapsed) {
    return (
      <aside className="collapsed-panel left-collapsed">
        <button onClick={onToggle} title="Show chat" aria-label="Show conversation panel"><MessageSquareText size={18} /></button>
        <span>Chat</span>
        <span className="vertical-count">{frame.messages.length}</span>
      </aside>
    );
  }

  return (
    <section className="chat-panel">
      <header className="panel-header">
        <div>
          <MessageSquareText size={16} />
          <strong>Conversation</strong>
          <span className="count">{frame.messages.length}</span>
        </div>
        <button onClick={onToggle} title="Collapse chat" aria-label="Collapse conversation panel"><PanelLeftClose size={17} /></button>
      </header>
      <div className="chat-scroll" ref={scrollRef}>
        {feed.map((item) =>
          item._kind === "message"
            ? <Message key={item.id} message={item} startedAt={startedAt} />
            : <Activity key={item.id} activity={item} />,
        )}
        {!feed.length && <div className="empty-panel">No conversation at this point.</div>}
      </div>
      <footer className="chat-footer">
        <span><Zap size={13} /> {allActivities} tool calls</span>
        <span>Read-only replay</span>
      </footer>
    </section>
  );
}

function FileIcon({ path, status }) {
  if (status === "added") return <FilePlus2 size={15} />;
  if (path?.endsWith(".json")) return <FileJson size={15} />;
  if (/\.(jsx?|tsx?|css|html)$/.test(path || "")) return <FileCode2 size={15} />;
  return <File size={15} />;
}

function FileTree({ files, selected, onSelect, query }) {
  const visible = Object.values(files).filter((file) => file.path.toLowerCase().includes(query.toLowerCase()));
  if (!visible.length) return <div className="empty-files">No files yet</div>;
  return (
    <div className="file-tree">
      <div className="tree-root"><ChevronDown size={14} /><FolderOpen size={15} /><span>workspace</span></div>
      {visible.map((file) => (
        <button
          key={file.path}
          className={`file-row ${file.status} ${selected === file.path ? "selected" : ""} ${file.deleted ? "deleted" : ""}`}
          onClick={() => onSelect(file.path)}
          aria-current={selected === file.path ? "true" : undefined}
          aria-label={`${file.path}, ${file.status}`}
        >
          <FileIcon path={file.path} status={file.status} />
          <span title={file.path}>{file.path.split("/").at(-1)}</span>
        </button>
      ))}
    </div>
  );
}

function SourceCode({ file }) {
  if (!file) {
    return (
      <div className="code-empty">
        <div><FileCode2 size={22} /></div>
        <h3>No file selected</h3>
        <p>Select a changed file to inspect its state at this moment.</p>
      </div>
    );
  }
  if (file.deleted) {
    return (
      <div className="code-empty">
        <div><FileCode2 size={22} /></div>
        <h3>File deleted</h3>
        <p>This file no longer exists at the selected point in time.</p>
      </div>
    );
  }
  const lines = (file.content || "").split("\n");
  return (
    <div className="source-wrap">
      {file.approximate && (
        <div className="approx-banner">
          <Info size={14} />
          Reconstructed from patch context; unchanged lines may be omitted.
        </div>
      )}
      <pre className="source-code">
        {lines.map((line, index) => (
          <span className="code-line" key={`${index}-${line}`}>
            <span className="line-no">{index + 1}</span>
            <code>{line || " "}</code>
          </span>
        ))}
      </pre>
    </div>
  );
}

export function Workspace({
  frame,
  filePaths,
  selectedFile,
  setSelectedFile,
  collapsed,
  onToggle,
  filesWidth,
  setFilesWidth,
  getFilesMax,
}) {
  const [query, setQuery] = useState("");
  const files = frame.files;
  const file = files[selectedFile];

  useEffect(() => {
    if (frame.focusFile && files[frame.focusFile]) setSelectedFile(frame.focusFile);
    else if (!files[selectedFile]) setSelectedFile(Object.keys(files)[0] || "");
  }, [frame.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="workspace">
      <div className="editor">
        <header className="editor-header">
          <div className={`tab ${file?.status || ""}`}>
            <FileIcon path={file?.path} status={file?.status} />
            <span>{file?.path?.split("/").at(-1) || "File state"}</span>
          </div>
          <div className="editor-actions">
            {file && (
              <span className="line-stats">
                <b>+{file.additions}</b>
                <em>−{file.deletions}</em>
              </span>
            )}
          </div>
        </header>
        <div className="breadcrumb">
          <Folder size={13} />
          <span>workspace</span>
          {file?.path?.split("/").map((part, index, parts) => (
            <span key={`${part}-${index}`} className={index === parts.length - 1 ? "current" : ""}>
              <ChevronRight size={12} /> {part}
            </span>
          ))}
        </div>
        <SourceCode file={file} />
      </div>
      <ResizeHandle
        className="files-resizer"
        orientation="vertical"
        value={filesWidth}
        min={160}
        max={getFilesMax}
        defaultValue={215}
        invert
        disabled={collapsed}
        label="Resize changed files panel"
        onChange={setFilesWidth}
      />
      {collapsed ? (
        <aside className="collapsed-panel right-collapsed">
          <button onClick={onToggle} title="Show files" aria-label="Show changed files panel"><Folder size={18} /></button>
          <span>Files</span>
          <span className="vertical-count">{filePaths.length}</span>
        </aside>
      ) : (
        <aside className="files-panel">
          <header className="panel-header">
            <div><Folder size={16} /><strong>Changed files</strong><span className="count">{filePaths.length}</span></div>
            <button onClick={onToggle} title="Collapse files" aria-label="Collapse changed files panel"><PanelRightClose size={17} /></button>
          </header>
          <label className="file-search">
            <Search size={14} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter files"
              aria-label="Filter changed files"
            />
          </label>
          <FileTree files={files} selected={selectedFile} onSelect={setSelectedFile} query={query} />
          <footer className="files-legend">
            <span className="added">Added</span>
            <span className="modified">Modified</span>
            <span className="deleted">Deleted</span>
          </footer>
        </aside>
      )}
    </section>
  );
}
