import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  HardDrive,
  Import,
  Info,
  LoaderCircle,
  MessageSquareText,
  Play,
  RefreshCw,
  Search,
  Upload,
  X,
} from "lucide-react";
import { buildReplay, parseSessionText } from "../replay";
import { useSearchParamState } from "../routing/useSearchParamState";
import { SAMPLE_SESSION } from "../sample";
import { loadSessionCatalog, sessionContentUrl } from "./sessionCatalog";

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

export function ImportScreen({ onLoad, error, setError }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [sessionQuery, setSessionQuery] = useSearchParamState("q");
  const [sessionSort, setSessionSort] = useSearchParamState("sort", "recent");
  const [sessionStatus, setSessionStatus] = useState("loading");
  const [sessionOrigin, setSessionOrigin] = useState("");
  const [openingPath, setOpeningPath] = useState("");

  const readFile = useCallback(
    async (file) => {
      if (!file) return;
      setError("");
      try {
        const raw = await file.text();
        onLoad(buildReplay(parseSessionText(raw), file.name), { upload: "1" });
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not read that session.");
      }
    },
    [onLoad, setError],
  );

  const findSessions = useCallback(async (signal) => {
    setSessionStatus("loading");
    try {
      const fetcher = (url) => fetch(url, { signal });
      const result = await loadSessionCatalog(fetcher);
      setSessions(result.sessions);
      setSessionOrigin(result.origin);
      setSessionStatus("ready");
    } catch (reason) {
      if (reason?.name === "AbortError") return;
      setSessions([]);
      setSessionOrigin("");
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
      const response = await fetch(sessionContentUrl(session));
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Could not open that session.");
      }
      const raw = await response.text();
      onLoad(
        buildReplay(parseSessionText(raw), session.filename),
        {
          session: session.path,
          ...(session.origin === "bundled" ? { bundled: "1" } : {}),
        },
      );
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
      <section className="import-content">
        <div className="session-sources">
          <section className="local-sessions" aria-labelledby="session-replays-title">
          <header className="local-sessions-header">
            <div>
              <span className="local-sessions-icon"><HardDrive size={15} /></span>
              <div>
                <h2 id="session-replays-title">Session replays</h2>
                <p>
                  {sessionStatus === "loading"
                    ? "Finding available sessions"
                    : sessionStatus === "ready"
                      ? `${sessions.length} ${sessionOrigin === "local" ? "local" : "featured"} session${sessions.length === 1 ? "" : "s"}`
                      : "Session discovery is unavailable"}
                </p>
              </div>
            </div>
            <button
              className="refresh-sessions"
              onClick={() => findSessions()}
              disabled={sessionStatus === "loading"}
              aria-label="Refresh sessions"
              title="Refresh sessions"
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
                  aria-label="Search sessions by project, time, or size"
                />
                {sessionQuery && (
                  <button onClick={() => setSessionQuery("")} aria-label="Clear session search">
                    <X size={13} />
                  </button>
                )}
              </label>
              <label className="session-sort" title="Sort sessions">
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
                No session catalog is available. You can still upload a session below.
              </div>
            )}
            {sessionStatus === "ready" && !sessions.length && (
              <div className="session-state">No sessions found.</div>
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
                  <small className="session-change-stats">
                    <span className="session-size">{formatFileSize(session.size)}</span>
                    <b>+{session.changeStats?.additions || 0}</b>
                    <em>−{session.changeStats?.deletions || 0}</em>
                    <span>
                      {session.changeStats?.files || 0}
                      {" "}
                      {session.changeStats?.files === 1 ? "file" : "files"}
                    </span>
                  </small>
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
              <Button onClick={() => onLoad(
                buildReplay(SAMPLE_SESSION, "demo-session.jsonl"),
                { demo: "1" },
              )}>
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
      </section>
    </main>
  );
}
