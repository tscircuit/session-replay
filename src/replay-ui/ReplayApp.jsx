import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Clock3,
  Code2,
  Info,
  Keyboard,
  MessageSquareText,
} from "lucide-react";
import { formatTime, timeDistance } from "../replay";
import { useSearchParamState } from "../routing/useSearchParamState";
import { Mark } from "../ui/Mark";
import { clamp, ResizeHandle } from "../ui/ResizeHandle";
import { ChatPanel, Workspace } from "./ReplayPanels";
import { Timeline } from "./Timeline";

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

export function ReplayApp({ replay, onClose }) {
  const rootRef = useRef(null);
  const isNarrow = useMediaQuery("(max-width: 760px)");
  const defaultMobileChatHeight = Math.max(150, Math.round((window.innerHeight - 150) * 0.42));
  const [eventParam, setEventParam] = useSearchParamState("event", "0");
  const parsedIndex = Number.parseInt(eventParam, 10);
  const index = clamp(Number.isFinite(parsedIndex) ? parsedIndex : 0, 0, replay.frames.length - 1);
  const setIndex = useCallback((nextIndex) => {
    setEventParam((current) => {
      const parsedCurrent = Number.parseInt(current, 10);
      const currentIndex = clamp(
        Number.isFinite(parsedCurrent) ? parsedCurrent : 0,
        0,
        replay.frames.length - 1,
      );
      const resolved = typeof nextIndex === "function" ? nextIndex(currentIndex) : nextIndex;
      return String(clamp(resolved, 0, replay.frames.length - 1));
    });
  }, [replay.frames.length, setEventParam]);
  const [playing, setPlaying] = useState(false);
  const [speedParam, setSpeedParam] = useSearchParamState("speed", "1");
  const speed = [0.5, 1, 1.5, 2].includes(Number(speedParam)) ? Number(speedParam) : 1;
  const setSpeed = useCallback((value) => setSpeedParam(String(value)), [setSpeedParam]);
  const [selectedFile, setSelectedFile] = useSearchParamState("file");
  const [chatParam, setChatParam] = useSearchParamState("chat");
  const [filesParam, setFilesParam] = useSearchParamState("files");
  const [infoParam, setInfoParam] = useSearchParamState("info");
  const chatCollapsed = chatParam === "closed";
  const filesCollapsed = filesParam === "closed";
  const showInfo = infoParam === "1";
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
  }, [index, playing, replay.frames.length, setIndex]);

  useEffect(() => {
    if (!playing) return undefined;
    if (index >= replay.frames.length - 1) {
      setPlaying(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setIndex((value) => value + 1), 1100 / speed);
    return () => window.clearTimeout(timer);
  }, [playing, index, speed, replay.frames.length, setIndex]);

  useEffect(() => {
    const handler = (event) => {
      if (event.key === "Escape") {
        setInfoParam("");
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
  }, [replay.frames.length, setIndex, setInfoParam, togglePlaying]);

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
            onClick={() => setInfoParam(showInfo ? "" : "1")}
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
          onToggle={() => setChatParam(chatCollapsed ? "" : "closed")}
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
          onToggle={() => setFilesParam(filesCollapsed ? "" : "closed")}
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
