import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useSearchParamState } from "../routing/useSearchParamState";

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

export function isVisibleActivity(activity) {
  return activity.name !== "write_stdin";
}

export function ChatPanel({ frame, startedAt, allActivities, collapsed, onToggle }) {
  const scrollRef = useRef(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [frame.id]);

  const feed = useMemo(() => {
    const items = [
      ...frame.messages.map((item) => ({ ...item, _kind: "message" })),
      ...frame.activities
        .filter(isVisibleActivity)
        .map((item) => ({ ...item, _kind: "activity" })),
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

function pathParts(path = "") {
  return String(path).split(/[\\/]+/).filter(Boolean);
}

export function fileBreadcrumbSegments(path) {
  return pathParts(path);
}

export function buildFileTree(files, query = "") {
  const root = { children: new Map() };
  const lowerQuery = query.toLowerCase();
  const visible = Object.values(files)
    .filter((file) => file.path.toLowerCase().includes(lowerQuery))
    .sort((a, b) => a.path.localeCompare(b.path));

  visible.forEach((file) => {
    const parts = pathParts(file.path);
    let current = root;
    parts.slice(0, -1).forEach((part, index) => {
      const folderPath = parts.slice(0, index + 1).join("/");
      if (!current.children.has(part)) {
        current.children.set(part, {
          children: new Map(),
          kind: "folder",
          name: part,
          path: folderPath,
        });
      }
      current = current.children.get(part);
    });
    current.children.set(file.path, {
      file,
      kind: "file",
      name: parts.at(-1) || file.path,
      path: file.path,
    });
  });

  const compactFolder = (entry) => {
    const names = [entry.name];
    let current = entry;
    while (current.children.size === 1) {
      const onlyChild = [...current.children.values()][0];
      if (onlyChild.kind !== "folder") break;
      names.push(onlyChild.name);
      current = onlyChild;
    }
    return current === entry ? entry : { ...current, name: names.join("/") };
  };

  const flatten = (node, depth = 0) => [...node.children.values()]
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    })
    .flatMap((entry) => {
      const compacted = entry.kind === "folder" ? compactFolder(entry) : entry;
      return [
        { ...compacted, depth },
        ...(compacted.kind === "folder" ? flatten(compacted, depth + 1) : []),
      ];
    });

  return flatten(root);
}

function FileTree({ files, selected, onSelect, query }) {
  const entries = buildFileTree(files, query);
  if (!entries.length) return <div className="empty-files">No files yet</div>;
  return (
    <div className="file-tree" role="tree" aria-label="Changed file tree">
      {entries.map((entry) => entry.kind === "folder" ? (
        <div
          key={entry.path}
          className="folder-row"
          role="treeitem"
          aria-expanded="true"
          style={{ "--depth": entry.depth }}
        >
          <ChevronDown size={14} />
          <FolderOpen size={15} />
          <span title={entry.path}>{entry.name}</span>
        </div>
      ) : (
        <button
          key={entry.path}
          className={`file-row ${entry.file.status} ${selected === entry.path ? "selected" : ""} ${entry.file.deleted ? "deleted" : ""}`}
          onClick={() => onSelect(entry.path)}
          aria-current={selected === entry.path ? "true" : undefined}
          aria-label={`${entry.path}, ${entry.file.status}`}
          role="treeitem"
          style={{ "--depth": entry.depth }}
        >
          <FileIcon path={entry.path} status={entry.file.status} />
          <span title={entry.path}>{entry.name}</span>
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

export function chooseWorkspaceFile(files, selectedFile, focusFile, frameChanged) {
  if (!frameChanged && files[selectedFile]) return selectedFile;
  if (focusFile && files[focusFile]) return focusFile;
  if (files[selectedFile]) return selectedFile;
  return Object.keys(files)[0] || "";
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
  const [query, setQuery] = useSearchParamState("filter");
  const [openFiles, setOpenFiles] = useState([]);
  const tabsRef = useRef(null);
  const previousFrameIdRef = useRef(frame.id);
  const files = frame.files;
  const file = files[selectedFile];

  const openFile = useCallback((path) => {
    if (!path) return;
    setOpenFiles((current) => current.includes(path) ? current : [...current, path]);
    setSelectedFile(path);
  }, [setSelectedFile]);

  useEffect(() => {
    const frameChanged = previousFrameIdRef.current !== frame.id;
    previousFrameIdRef.current = frame.id;
    const nextFile = chooseWorkspaceFile(
      files,
      selectedFile,
      frame.focusFile,
      frameChanged,
    );
    openFile(nextFile);
  }, [files, frame.focusFile, frame.id, openFile, selectedFile]);

  useEffect(() => {
    const tabs = tabsRef.current;
    const activeTab = tabs?.querySelector('[aria-selected="true"]');
    if (!tabs || !activeTab) return;

    const tabsBounds = tabs.getBoundingClientRect();
    const activeBounds = activeTab.getBoundingClientRect();
    if (activeBounds.left < tabsBounds.left) {
      tabs.scrollBy({ left: activeBounds.left - tabsBounds.left - 1, behavior: "smooth" });
    } else if (activeBounds.right > tabsBounds.right) {
      tabs.scrollBy({ left: activeBounds.right - tabsBounds.right + 1, behavior: "smooth" });
    }
  }, [openFiles, selectedFile]);

  const selectAdjacentTab = (direction) => {
    const selectableFiles = openFiles.filter((path) => files[path]);
    if (!selectableFiles.length) return;
    const currentIndex = selectableFiles.indexOf(selectedFile);
    const nextIndex = currentIndex < 0
      ? 0
      : (currentIndex + direction + selectableFiles.length) % selectableFiles.length;
    setSelectedFile(selectableFiles[nextIndex]);
  };

  return (
    <section className="workspace">
      <div className="editor">
        <header className="editor-header">
          <div
            className="editor-tabs"
            role="tablist"
            aria-label="Open files"
            ref={tabsRef}
            onWheel={(event) => {
              if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
                event.currentTarget.scrollLeft += event.deltaY;
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                selectAdjacentTab(event.key === "ArrowRight" ? 1 : -1);
              } else if (event.key === "Home" || event.key === "End") {
                event.preventDefault();
                const selectableFiles = openFiles.filter((path) => files[path]);
                setSelectedFile(
                  event.key === "Home" ? selectableFiles[0] : selectableFiles.at(-1),
                );
              }
            }}
          >
            {openFiles.map((path) => {
              const tabFile = files[path];
              const active = path === selectedFile;
              return (
                <button
                  className={`tab ${tabFile?.status || ""} ${active ? "active" : ""}`}
                  key={path}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  disabled={!tabFile}
                  tabIndex={active ? 0 : -1}
                  title={path}
                  onClick={() => setSelectedFile(path)}
                >
                  <FileIcon path={path} status={tabFile?.status} />
                  <span>{path.split("/").at(-1)}</span>
                </button>
              );
            })}
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
          {(file ? fileBreadcrumbSegments(file.path) : ["No file selected"]).map((part, index, parts) => (
            <span key={`${part}-${index}`} className={index === parts.length - 1 ? "current" : ""}>
              {index > 0 && <ChevronRight size={12} />} {part}
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
          <FileTree files={files} selected={selectedFile} onSelect={openFile} query={query} />
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
