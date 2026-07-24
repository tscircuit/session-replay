import React, { useEffect, useRef } from "react";
import {
  Bot,
  FilePenLine,
  MessageSquareText,
  Pause,
  Play,
  RotateCcw,
  Terminal,
} from "lucide-react";
import { formatTime, timeDistance } from "../replay";
import { ResizeHandle } from "../ui/ResizeHandle";

const speedOptions = [0.5, 1, 1.5, 2];
const timelineEventGap = 18;
const timelineEdgePadding = 24;

function compactText(value, limit = 72) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function displayToolName(name) {
  return String(name || "tool").replaceAll("_", " ");
}

export function describeTimelineFrame(frame, eventNumber) {
  const event = frame?.event;
  if (event?.kind === "message") {
    const user = event.role === "user";
    return {
      kind: `timeline-message timeline-${user ? "user" : "assistant"}`,
      label: user ? "User message" : "Assistant response",
      detail: compactText(event.text),
      title: `Event ${eventNumber} · ${user ? "User message" : "Assistant response"} · ${compactText(event.text, 110)}`,
      icon: user ? MessageSquareText : Bot,
    };
  }
  if (event?.kind === "tool") {
    const activity = frame.activities.at(-1);
    const changedFiles = activity?.files || [];
    const fileStates = changedFiles.map((path) => frame.files[path]).filter(Boolean);
    const additions = fileStates.reduce((total, file) => total + file.additions, 0);
    const deletions = fileStates.reduce((total, file) => total + file.deletions, 0);
    const fileNames = changedFiles.map((path) => path.split("/").at(-1)).join(", ");
    const fileDetail = changedFiles.length
      ? `${changedFiles.length} file${changedFiles.length === 1 ? "" : "s"} · +${additions} −${deletions} · ${fileNames}`
      : compactText(activity?.label || displayToolName(event.name));
    return {
      kind: `timeline-tool ${changedFiles.length ? "timeline-file-change" : ""}`.trim(),
      label: displayToolName(event.name),
      detail: compactText(fileDetail),
      title: `Event ${eventNumber} · ${displayToolName(event.name)} · ${compactText(fileDetail, 110)}`,
      icon: changedFiles.length ? FilePenLine : Terminal,
    };
  }
  return {
    kind: "timeline-event",
    label: "Session event",
    detail: "",
    title: `Event ${eventNumber}`,
    icon: MessageSquareText,
  };
}

export function Timeline({
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
  const activeSummary = describeTimelineFrame(frames[index], index + 1);
  const ActiveIcon = activeSummary.icon;

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
          <span className={`event-summary ${activeSummary.kind}`}>
            <ActiveIcon size={12} />
            <strong>{activeSummary.label}</strong>
            {activeSummary.detail && <em>{activeSummary.detail}</em>}
          </span>
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
              {frames.map((frame, tick) => {
                const summary = describeTimelineFrame(frame, tick + 1);
                return (
                  <button
                    key={frame.id}
                    className={`${tick <= index ? "passed" : ""} ${tick === index ? "active" : ""} ${summary.kind}`}
                    style={{ left: `${frames.length <= 1 ? 0 : (tick / (frames.length - 1)) * 100}%` }}
                    onClick={() => { setPlaying(false); setIndex(tick); }}
                    title={`${summary.title} · ${formatTime(frame.timestamp)}`}
                    aria-label={`Go to ${summary.title}`}
                    tabIndex={-1}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
