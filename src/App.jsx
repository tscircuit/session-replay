import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
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
    if (!query) return sessions;
    return sessions.filter((session) =>
      [session.title, session.cwd, session.id, session.filename]
        .some((value) => value?.toLowerCase().includes(query)));
  }, [sessionQuery, sessions]);

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
            <label className="session-search">
              <Search size={14} />
              <input
                value={sessionQuery}
                onChange={(event) => setSessionQuery(event.target.value)}
                placeholder="Search by project, path, or session ID"
                aria-label="Search local sessions"
              />
              {sessionQuery && (
                <button onClick={() => setSessionQuery("")} aria-label="Clear session search">
                  <X size={13} />
                </button>
              )}
            </label>
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
  const command = activity.name === "exec_command";
  return (
    <div className="activity">
      <div className="activity-rule" />
      <div className="activity-icon">{command ? <Terminal size={14} /> : <Code2 size={14} />}</div>
      <div className="activity-copy">
        <span>{command ? "Ran command" : activity.label}</span>
        {command
          ? <code>{activity.label}</code>
          : activity.files.map((file, index) => <code key={`${file}-${index}`}>{file}</code>)}
      </div>
      <Check size={14} className="activity-check" />
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

function Workspace({ frame, filePaths, selectedFile, setSelectedFile, collapsed, onToggle }) {
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

function Timeline({ replay, index, setIndex, playing, setPlaying, onTogglePlaying, speed, setSpeed }) {
  const frames = replay.frames;
  const start = frames[0]?.timestamp;
  const end = frames.at(-1)?.timestamp;
  return (
    <footer className="timeline">
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
        <div className="range-shell">
          <div className="range-progress" style={{ width: `${frames.length <= 1 ? 0 : (index / (frames.length - 1)) * 100}%` }} />
          <input
            aria-label="Session timeline"
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
      <div className="timeline-status" aria-live="polite">
        <span><Circle size={8} fill="currentColor" /> Event {index + 1} of {frames.length}</span>
      </div>
    </footer>
  );
}

function ReplayApp({ replay, onClose }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [selectedFile, setSelectedFile] = useState("");
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [filesCollapsed, setFilesCollapsed] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const frame = replay.frames[index];
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
      if (
        event.target instanceof Element
        && event.target.closest("button, input, textarea, select, a, [contenteditable='true']")
      ) return;
      if (event.code === "Space") {
        event.preventDefault();
        togglePlaying();
      }
      if (event.key === "ArrowRight") {
        setPlaying(false);
        setIndex((value) => Math.min(replay.frames.length - 1, value + 1));
      }
      if (event.key === "ArrowLeft") {
        setPlaying(false);
        setIndex((value) => Math.max(0, value - 1));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [replay.frames.length, togglePlaying]);

  return (
    <main className="replay-app">
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
        <Workspace
          frame={frame}
          filePaths={replay.filePaths}
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
          collapsed={filesCollapsed}
          onToggle={() => setFilesCollapsed(!filesCollapsed)}
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
