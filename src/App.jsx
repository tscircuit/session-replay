import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpDown,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Code2,
  File,
  FileCode2,
  FileJson,
  FilePlus2,
  Folder,
  FolderOpen,
  Github,
  HardDrive,
  Import,
  Info,
  Keyboard,
  LoaderCircle,
  MessageSquareText,
  PanelLeftClose,
  PanelRightClose,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Terminal,
  Upload,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import { buildReplay, formatTime, parseSessionText, timeDistance } from "./replay";
import { SAMPLE_SESSION } from "./sample";

const speedOptions = [0.5, 1, 1.5, 2];
const timelineEventGap = 18;
const timelineEdgePadding = 24;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function Mark() {
  return (
    <div className="mark" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}

function Button({ className = "", children, ...props }) {
  return (
    <button className={`button ${className}`} {...props}>
      {children}
    </button>
  );
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
}

function ResizeHandle({
  className = "",
  orientation,
  value,
  min,
  max,
  defaultValue,
  invert = false,
  disabled = false,
  label,
  onChange,
}) {
  const dragRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const resolveMax = () => typeof max === "function" ? max() : max;
  const updateValue = (next) => onChange(clamp(next, min, resolveMax()));

  const stopDragging = (target, pointerId) => {
    dragRef.current = null;
    setDragging(false);
    document.body.classList.remove("is-resizing");
    if (target?.hasPointerCapture?.(pointerId)) target.releasePointerCapture(pointerId);
  };

  useEffect(() => () => document.body.classList.remove("is-resizing"), []);

  const coordinate = (event) => orientation === "vertical" ? event.clientX : event.clientY;
  const direction = invert ? -1 : 1;
  const resolvedMax = resolveMax();

  return (
    <div
      className={`resize-handle ${orientation} ${dragging ? "dragging" : ""} ${className}`}
      role="separator"
      aria-label={label}
      aria-orientation={orientation}
      aria-valuemin={min}
      aria-valuemax={Math.round(resolvedMax)}
      aria-valuenow={Math.round(value)}
      aria-hidden={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onDoubleClick={() => !disabled && updateValue(defaultValue)}
      onPointerDown={(event) => {
        if (disabled || event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = { pointerId: event.pointerId, start: coordinate(event), value };
        setDragging(true);
        document.body.classList.add("is-resizing");
      }}
      onPointerMove={(event) => {
        if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
        event.preventDefault();
        const delta = (coordinate(event) - dragRef.current.start) * direction;
        updateValue(dragRef.current.value + delta);
      }}
      onPointerUp={(event) => stopDragging(event.currentTarget, event.pointerId)}
      onPointerCancel={(event) => stopDragging(event.currentTarget, event.pointerId)}
      onKeyDown={(event) => {
        if (disabled) return;
        const decreaseKey = orientation === "vertical" ? "ArrowLeft" : "ArrowUp";
        const increaseKey = orientation === "vertical" ? "ArrowRight" : "ArrowDown";
        if (event.key === "Home") {
          event.preventDefault();
          updateValue(defaultValue);
        } else if (event.key === decreaseKey || event.key === increaseKey) {
          event.preventDefault();
          const amount = event.shiftKey ? 40 : 10;
          const keyboardDirection = event.key === increaseKey ? 1 : -1;
          updateValue(value + keyboardDirection * direction * amount);
        }
      }}
      title={`${label}. Drag to resize; double-click to reset.`}
    />
  );
}

function formatSessionDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return new Intl.DateTimeFormat(undefined, sameDay
    ? { hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

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

function ImportScreen({ onLoad, error, setError }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [sessionQuery, setSessionQuery] = useState("");
  const [sessionSort, setSessionSort] = useState("recent");
  const [sessionStatus, setSessionStatus] = useState("loading");
  const [openingPath, setOpeningPath] = useState("");

  const readFile = useCallback(
    async (file) => {
      if (!file) return;
      setError("");
      try {
        const raw = await file.text();
        onLoad(buildReplay(parseSessionText(raw), file.name));
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not read that session.");
      }
    },
    [onLoad, setError],
  );

  const findSessions = useCallback(async (signal) => {
    setSessionStatus("loading");
    try {
      const response = await fetch("/api/sessions", { signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not find local sessions.");
      setSessions(result.sessions || []);
      setSessionStatus("ready");
    } catch (reason) {
      if (reason?.name === "AbortError") return;
      setSessions([]);
      setSessionStatus("unavailable");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    findSessions(controller.signal);
    return () => controller.abort();
  }, [findSessions]);

  const openSession = useCallback(async (session) => {
    setOpeningPath(session.path);
    setError("");
    try {
      const response = await fetch(`/api/session?path=${encodeURIComponent(session.path)}`);
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Could not open that session.");
      }
      const raw = await response.text();
      onLoad(buildReplay(parseSessionText(raw), session.filename));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not open that session.");
    } finally {
      setOpeningPath("");
    }
  }, [onLoad, setError]);

  const visibleSessions = useMemo(() => {
    const query = sessionQuery.trim().toLowerCase();
    const filtered = query
      ? sessions.filter((session) =>
        [
          session.title,
          session.cwd,
          session.id,
          session.filename,
          session.modifiedAt,
          formatSessionDate(session.modifiedAt),
          formatFileSize(session.size),
        ].some((value) => String(value || "").toLowerCase().includes(query)))
      : [...sessions];

    if (sessionSort === "recent") return filtered;

    return filtered.sort((a, b) => {
      if (sessionSort === "oldest") {
        return new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime();
      }
      if (sessionSort === "largest") return (b.size || 0) - (a.size || 0);
      if (sessionSort === "smallest") return (a.size || 0) - (b.size || 0);
      return 0;
    });
  }, [sessionQuery, sessionSort, sessions]);

  return (
    <main className="import-page">
      <nav className="import-nav">
        <div className="brand">
          <Mark />
          <span>Codex Replay</span>
          <span className="beta">BETA</span>
        </div>
        <a href="https://github.com/openai/codex" target="_blank" rel="noreferrer">
          <Github size={17} />
          Codex
        </a>
      </nav>
      <section className="import-content">
        <div className="eyebrow">
          <Sparkles size={14} />
          Session playback for Codex
        </div>
        <h1>See the work,<br />not just the result.</h1>
        <p className="lede">
          Turn a Codex session file into a precise timeline of the conversation,
          tool calls, and every file state along the way.
        </p>
        <div className="session-sources">
          <section className="local-sessions" aria-labelledby="local-sessions-title">
          <header className="local-sessions-header">
            <div>
              <span className="local-sessions-icon"><HardDrive size={15} /></span>
              <div>
                <h2 id="local-sessions-title">Local sessions</h2>
                <p>
                  {sessionStatus === "loading"
                    ? "Looking in ~/.codex/sessions"
                    : sessionStatus === "ready"
                      ? `${sessions.length} recent session${sessions.length === 1 ? "" : "s"} found`
                      : "Automatic discovery is unavailable"}
                </p>
              </div>
            </div>
            <button
              className="refresh-sessions"
              onClick={() => findSessions()}
              disabled={sessionStatus === "loading"}
              aria-label="Refresh local sessions"
              title="Refresh local sessions"
            >
              <RefreshCw size={15} className={sessionStatus === "loading" ? "spinning" : ""} />
            </button>
          </header>
          {sessionStatus === "ready" && sessions.length > 0 && (
            <div className="session-tools">
              <label className="session-search">
                <Search size={14} />
                <input
                  value={sessionQuery}
                  onChange={(event) => setSessionQuery(event.target.value)}
                  placeholder="Search project, time, or size"
                  aria-label="Search local sessions by project, time, or size"
                />
                {sessionQuery && (
                  <button onClick={() => setSessionQuery("")} aria-label="Clear session search">
                    <X size={13} />
                  </button>
                )}
              </label>
              <label className="session-sort" title="Sort local sessions">
                <ArrowUpDown size={13} />
                <select
                  value={sessionSort}
                  onChange={(event) => setSessionSort(event.target.value)}
                  aria-label="Sort local sessions"
                >
                  <option value="recent">Recent</option>
                  <option value="oldest">Oldest</option>
                  <option value="largest">Largest</option>
                  <option value="smallest">Smallest</option>
                </select>
                <ChevronDown size={12} />
              </label>
            </div>
          )}
          <div className="session-list" aria-live="polite">
            {sessionStatus === "loading" && (
              <div className="session-state"><LoaderCircle size={17} className="spinning" /> Finding sessions…</div>
            )}
            {sessionStatus === "unavailable" && (
              <div className="session-state">
                Start the local Vite server to browse Codex sessions automatically.
              </div>
            )}
            {sessionStatus === "ready" && !sessions.length && (
              <div className="session-state">No sessions found in ~/.codex/sessions.</div>
            )}
            {sessionStatus === "ready" && sessions.length > 0 && !visibleSessions.length && (
              <div className="session-state">No sessions match “{sessionQuery}”.</div>
            )}
            {visibleSessions.map((session) => (
              <button
                className={`session-row ${session.current ? "current" : ""}`}
                key={session.path}
                onClick={() => openSession(session)}
                disabled={Boolean(openingPath)}
              >
                <span className="session-row-icon">
                  {openingPath === session.path
                    ? <LoaderCircle size={16} className="spinning" />
                    : <MessageSquareText size={16} />}
                </span>
                <span className="session-row-copy">
                  <span>
                    <strong>{session.title}</strong>
                    {session.current && <i>CURRENT</i>}
                  </span>
                  <small title={session.cwd}>{session.cwd || session.filename}</small>
                </span>
                <span className="session-row-meta">
                  <time dateTime={session.modifiedAt}>{formatSessionDate(session.modifiedAt)}</time>
                  <small>{formatFileSize(session.size)}</small>
                </span>
                <ChevronRight size={15} className="session-row-arrow" />
              </button>
            ))}
          </div>
          </section>
          <div className="import-divider"><span>or</span></div>
          <div
            className={`drop-zone ${dragging ? "dragging" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={(event) => {
              if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
                setDragging(false);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              readFile(event.dataTransfer.files[0]);
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".json,.jsonl,.txt,application/json"
              onChange={(event) => {
                readFile(event.target.files[0]);
                event.target.value = "";
              }}
            />
            <div className="upload-icon"><Upload size={22} /></div>
            <h2>Drop a session file here</h2>
            <p>Codex JSON or JSONL · processed locally in your browser</p>
            <div className="drop-actions">
              <Button className="primary" onClick={() => inputRef.current?.click()}>
                <Import size={16} /> Choose file
              </Button>
              <Button onClick={() => onLoad(buildReplay(SAMPLE_SESSION, "demo-session.jsonl"))}>
                <Play size={15} fill="currentColor" /> Explore demo
              </Button>
            </div>
          </div>
        </div>
        {error && (
          <div className="import-error" role="alert">
            <Info size={15} />
            <span>{error}</span>
            <button onClick={() => setError("")} aria-label="Dismiss error"><X size={14} /></button>
          </div>
        )}
        <div className="privacy-note">
          <div><span className="privacy-dot" /><strong>Private by design</strong></div>
          <p>Your session never leaves this device.</p>
        </div>
      </section>
      <div className="import-grid" aria-hidden="true" />
    </main>
  );
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

function ChatPanel({ frame, startedAt, allActivities, collapsed, onToggle }) {
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

function Workspace({
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

function Timeline({
  replay,
  index,
  setIndex,
  playing,
  setPlaying,
  onTogglePlaying,
  speed,
  setSpeed,
  height,
  setHeight,
  getMaxHeight,
}) {
  const viewportRef = useRef(null);
  const frames = replay.frames;
  const start = frames[0]?.timestamp;
  const end = frames.at(-1)?.timestamp;
  const trackMinWidth = Math.max(0, (frames.length - 1) * timelineEventGap + 10);

  useEffect(() => {
    const viewport = viewportRef.current;
    const track = viewport?.firstElementChild;
    if (!viewport || !track) return undefined;

    const revealActiveEvent = () => {
      const maxScroll = Math.max(0, track.scrollWidth - viewport.clientWidth);
      if (!maxScroll) {
        viewport.scrollLeft = 0;
        return;
      }

      const progress = frames.length <= 1 ? 0 : index / (frames.length - 1);
      const eventPosition = 5 + progress * (track.scrollWidth - 10);
      const visibleStart = viewport.scrollLeft + timelineEdgePadding;
      const visibleEnd = viewport.scrollLeft + viewport.clientWidth - timelineEdgePadding;

      if (eventPosition < visibleStart) {
        viewport.scrollLeft = Math.max(0, eventPosition - timelineEdgePadding);
      } else if (eventPosition > visibleEnd) {
        viewport.scrollLeft = Math.min(
          maxScroll,
          eventPosition - viewport.clientWidth + timelineEdgePadding,
        );
      }
    };

    revealActiveEvent();
    const observer = new ResizeObserver(revealActiveEvent);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [frames.length, index]);

  return (
    <footer className="timeline">
      <ResizeHandle
        className="timeline-resizer"
        orientation="horizontal"
        value={height}
        min={72}
        max={getMaxHeight}
        defaultValue={92}
        invert
        label="Resize timeline"
        onChange={setHeight}
      />
      <div className="play-controls">
        <button onClick={() => setIndex(0)} title="Restart" aria-label="Restart replay"><RotateCcw size={16} /></button>
        <button
          className="play-button"
          onClick={onTogglePlaying}
          title={playing ? "Pause" : "Play"}
          aria-label={playing ? "Pause replay" : "Play replay"}
          aria-pressed={playing}
        >
          {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
        </button>
        <button
          className="speed-button"
          onClick={() => setSpeed(speedOptions[(speedOptions.indexOf(speed) + 1) % speedOptions.length])}
          aria-label={`Playback speed ${speed} times. Choose next speed`}
        >
          {speed}×
        </button>
      </div>
      <div className="track-wrap">
        <div className="time-row">
          <span>{formatTime(frames[index]?.timestamp, `Event ${index + 1}`)}</span>
          <span>{timeDistance(start, frames[index]?.timestamp)} / {timeDistance(start, end)}</span>
        </div>
        <div className="range-viewport" ref={viewportRef}>
          <div className="range-shell" style={{ minWidth: `${trackMinWidth}px` }}>
            <div className="range-progress" style={{ width: `${frames.length <= 1 ? 0 : (index / (frames.length - 1)) * 100}%` }} />
            <input
              aria-label="Session timeline"
              aria-keyshortcuts="ArrowLeft ArrowRight"
              type="range"
              min="0"
              max={Math.max(0, frames.length - 1)}
              value={index}
              aria-valuetext={`Event ${index + 1} of ${frames.length}`}
              onChange={(event) => {
                setPlaying(false);
                setIndex(Number(event.target.value));
              }}
            />
            <div className="ticks">
              {frames.map((frame, tick) => (
                <button
                  key={frame.id}
                  className={`${tick <= index ? "passed" : ""} ${frame.event?.kind}`}
                  style={{ left: `${frames.length <= 1 ? 0 : (tick / (frames.length - 1)) * 100}%` }}
                  onClick={() => { setPlaying(false); setIndex(tick); }}
                  title={`${frame.event?.kind || "event"} · ${formatTime(frame.timestamp)}`}
                  aria-label={`Go to event ${tick + 1}: ${frame.event?.kind || "event"}`}
                  tabIndex={-1}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

function ReplayApp({ replay, onClose }) {
  const rootRef = useRef(null);
  const isNarrow = useMediaQuery("(max-width: 760px)");
  const defaultMobileChatHeight = Math.max(150, Math.round((window.innerHeight - 150) * 0.42));
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [selectedFile, setSelectedFile] = useState("");
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [filesCollapsed, setFilesCollapsed] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [chatWidth, setChatWidth] = useState(() => clamp(window.innerWidth * 0.35, 310, 520));
  const [mobileChatHeight, setMobileChatHeight] = useState(defaultMobileChatHeight);
  const [filesWidth, setFilesWidth] = useState(215);
  const [timelineHeight, setTimelineHeight] = useState(92);
  const frame = replay.frames[index];
  const getChatMax = () => {
    if (isNarrow) {
      const bodyHeight = rootRef.current?.querySelector(".replay-body")?.clientHeight || window.innerHeight - 150;
      return Math.max(150, bodyHeight - 165);
    }
    const rootWidth = rootRef.current?.clientWidth || window.innerWidth;
    return Math.max(260, rootWidth - 360);
  };
  const getFilesMax = () => {
    const workspaceWidth = rootRef.current?.querySelector(".workspace")?.clientWidth || window.innerWidth * 0.65;
    return Math.max(160, workspaceWidth - 285);
  };
  const getTimelineMax = () => {
    const rootHeight = rootRef.current?.clientHeight || window.innerHeight;
    return Math.max(72, rootHeight - (isNarrow ? 54 : 58) - 220);
  };
  const togglePlaying = useCallback(() => {
    if (!playing && index >= replay.frames.length - 1) setIndex(0);
    setPlaying((value) => !value);
  }, [index, playing, replay.frames.length]);

  useEffect(() => {
    if (!playing) return undefined;
    if (index >= replay.frames.length - 1) {
      setPlaying(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setIndex((value) => value + 1), 1100 / speed);
    return () => window.clearTimeout(timer);
  }, [playing, index, speed, replay.frames.length]);

  useEffect(() => {
    const handler = (event) => {
      if (event.key === "Escape") {
        setShowInfo(false);
        return;
      }
      const target = event.target instanceof Element ? event.target : null;
      const isEditing = target?.closest("textarea, select, input:not([type='range']), [contenteditable='true']");
      if (event.code === "Space") {
        if (target?.closest("button, input, textarea, select, a, [contenteditable='true']")) return;
        event.preventDefault();
        togglePlaying();
      }
      if (event.key === "ArrowRight" && !isEditing) {
        event.preventDefault();
        setPlaying(false);
        setIndex((value) => Math.min(replay.frames.length - 1, value + 1));
      }
      if (event.key === "ArrowLeft" && !isEditing) {
        event.preventDefault();
        setPlaying(false);
        setIndex((value) => Math.max(0, value - 1));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [replay.frames.length, togglePlaying]);

  useEffect(() => {
    const fitPanels = () => {
      if (isNarrow) setMobileChatHeight((value) => clamp(value, 150, getChatMax()));
      else setChatWidth((value) => clamp(value, 260, getChatMax()));
      setFilesWidth((value) => clamp(value, 160, getFilesMax()));
      setTimelineHeight((value) => clamp(value, 72, getTimelineMax()));
    };
    fitPanels();
    window.addEventListener("resize", fitPanels);
    return () => window.removeEventListener("resize", fitPanels);
  }, [isNarrow]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main
      className="replay-app"
      ref={rootRef}
      style={{
        "--chat-width": `${chatWidth}px`,
        "--mobile-chat-height": `${mobileChatHeight}px`,
        "--files-width": `${filesWidth}px`,
        "--timeline-height": `${timelineHeight}px`,
      }}
    >
      <header className="topbar">
        <div className="topbar-left">
          <button
            className="back-button"
            onClick={onClose}
            title="Open another session"
            aria-label="Open another session"
          >
            <ArrowLeft size={18} />
          </button>
          <Mark />
          <div className="session-title">
            <strong>{replay.session.title}</strong>
            <span>{replay.session.filename}</span>
          </div>
        </div>
        <div className="session-summary">
          <span><MessageSquareText size={14} /> {replay.stats.turns} turns</span>
          <span><Code2 size={14} /> {replay.stats.files} files</span>
          <span><Clock3 size={14} /> {timeDistance(replay.frames[0]?.timestamp, replay.frames.at(-1)?.timestamp) || "replay"}</span>
        </div>
        <div className="topbar-actions">
          <button
            onClick={() => setShowInfo((value) => !value)}
            className={showInfo ? "active" : ""}
            aria-label="Session details"
            aria-expanded={showInfo}
            aria-controls="session-details"
          >
            <Info size={17} />
          </button>
        </div>
        {showInfo && (
          <div className="info-popover" id="session-details">
            <strong>Session details</strong>
            <dl>
              <dt>Started</dt><dd>{formatTime(replay.session.startedAt)}</dd>
              <dt>Session ID</dt><dd>{replay.session.id || "Not provided"}</dd>
              <dt>Working dir</dt><dd>{replay.session.cwd || "Not provided"}</dd>
            </dl>
            {replay.warnings.map((warning) => <p key={warning}>{warning}</p>)}
          </div>
        )}
      </header>
      <div className={`replay-body ${chatCollapsed ? "chat-is-collapsed" : ""} ${filesCollapsed ? "files-is-collapsed" : ""}`}>
        <ChatPanel
          frame={frame}
          startedAt={replay.frames[0]?.timestamp}
          allActivities={replay.stats.toolCalls}
          collapsed={chatCollapsed}
          onToggle={() => setChatCollapsed(!chatCollapsed)}
        />
        <ResizeHandle
          className="chat-resizer"
          orientation={isNarrow ? "horizontal" : "vertical"}
          value={isNarrow ? mobileChatHeight : chatWidth}
          min={isNarrow ? 150 : 260}
          max={getChatMax}
          defaultValue={isNarrow ? defaultMobileChatHeight : clamp(window.innerWidth * 0.35, 310, 520)}
          disabled={chatCollapsed}
          label="Resize conversation panel"
          onChange={isNarrow ? setMobileChatHeight : setChatWidth}
        />
        <Workspace
          frame={frame}
          filePaths={replay.filePaths}
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
          collapsed={filesCollapsed}
          onToggle={() => setFilesCollapsed(!filesCollapsed)}
          filesWidth={filesWidth}
          setFilesWidth={setFilesWidth}
          getFilesMax={getFilesMax}
        />
      </div>
      <Timeline
        replay={replay}
        index={index}
        setIndex={setIndex}
        playing={playing}
        setPlaying={setPlaying}
        onTogglePlaying={togglePlaying}
        speed={speed}
        setSpeed={setSpeed}
        height={timelineHeight}
        setHeight={setTimelineHeight}
        getMaxHeight={getTimelineMax}
      />
      <div className="shortcut-hint"><Keyboard size={13} /> Space to play · ← → to step</div>
    </main>
  );
}

export default function App() {
  const [replay, setReplay] = useState(null);
  const [error, setError] = useState("");
  return replay ? (
    <ReplayApp replay={replay} onClose={() => setReplay(null)} />
  ) : (
    <ImportScreen onLoad={setReplay} error={error} setError={setError} />
  );
}
