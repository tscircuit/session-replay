import React, { useEffect, useRef } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { formatTime, timeDistance } from "../replay";
import { ResizeHandle } from "../ui/ResizeHandle";

const speedOptions = [0.5, 1, 1.5, 2];
const timelineEventGap = 18;
const timelineEdgePadding = 24;

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
