import React, { useMemo } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Braces,
  ChartNoAxesColumnIncreasing,
  ChevronRight,
  Clock3,
  FileCode2,
  FilePenLine,
  Files,
  Gauge,
  LoaderCircle,
  MessageSquareText,
  Play,
  Wrench,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { formatTime, timeDistance } from "../replay";
import { useRouteReplay } from "../routing/useRouteReplay";
import { Mark } from "../ui/Mark";
import { buildSessionAnalytics } from "./sessionAnalytics";
import { ToolUsageDonut } from "./ToolUsageDonut";

function compactNumber(value) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(undefined, {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function Metric({ icon: Icon, label, value, note, tone = "" }) {
  return (
    <article className={`analytics-metric ${tone}`}>
      <div><Icon size={16} /></div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function Ranking({ items, empty, renderMeta, onSelect }) {
  if (!items.length) return <div className="analytics-empty">{empty}</div>;
  return (
    <div className="analytics-ranking">
      {items.map((item, index) => {
        const content = (
          <>
            <span className="rank-number">{String(index + 1).padStart(2, "0")}</span>
            <div className="rank-copy">
              <div>
                <strong title={item.label}>{item.label.replaceAll("_", " ")}</strong>
                {renderMeta?.(item)}
              </div>
            </div>
            <span className="rank-count">
              {item.count}
              {onSelect && <ChevronRight size={13} />}
            </span>
          </>
        );
        return onSelect ? (
          <button
            className="analytics-rank interactive"
            key={`${item.tool || ""}:${item.label}`}
            onClick={() => onSelect(item)}
          >
            {content}
          </button>
        ) : (
          <div className="analytics-rank" key={`${item.tool || ""}:${item.label}`}>
            {content}
          </div>
        );
      })}
    </div>
  );
}

function PanelHeading({ icon: Icon, title, copy, badge }) {
  return (
    <header className="analytics-panel-heading">
      <div className="panel-heading-icon"><Icon size={16} /></div>
      <div>
        <h2>{title}</h2>
        <p>{copy}</p>
      </div>
      {badge && <span>{badge}</span>}
    </header>
  );
}

function LoadingState({ error, onBack }) {
  return (
    <main className="route-state">
      {error ? (
        <>
          <strong>Could not open analytics</strong>
          <p>{error}</p>
          <button className="button" onClick={onBack}><ArrowLeft size={15} /> Back</button>
        </>
      ) : (
        <><LoaderCircle size={20} className="spinning" /> Loading analytics…</>
      )}
    </main>
  );
}

export function AnalyticsRoute({ transientReplay }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { replay, error } = useRouteReplay(params, transientReplay);
  const analytics = useMemo(
    () => replay ? buildSessionAnalytics(replay) : null,
    [replay],
  );

  if (!replay || !analytics) {
    return <LoadingState error={error} onBack={() => navigate("/")} />;
  }

  const { totals } = analytics;
  const duration = timeDistance(
    replay.frames[0]?.timestamp,
    replay.frames.at(-1)?.timestamp,
  ) || "—";
  const eventTotal = replay.stats.toolCalls + replay.stats.messages;
  const toolShare = eventTotal ? Math.round((replay.stats.toolCalls / eventTotal) * 100) : 0;
  const openTool = (item) => navigate(
    `/analytics/tool/${encodeURIComponent(item.label)}?${params.toString()}`,
  );
  return (
    <main className="analytics-page">
      <nav className="analytics-nav">
        <div className="analytics-brand">
          <button onClick={() => navigate(`/replay?${params.toString()}`)} aria-label="Back to replay">
            <ArrowLeft size={17} />
          </button>
          <Mark />
          <span>Codex Replay</span>
          <i />
          <b>Analytics</b>
        </div>
        <button
          className="analytics-replay-button"
          onClick={() => navigate(`/replay?${params.toString()}`)}
        >
          <Play size={13} fill="currentColor" /> Open replay
        </button>
      </nav>

      <div className="analytics-shell">
        <header className="analytics-hero">
          <div>
            <span className="analytics-eyebrow">
              <ChartNoAxesColumnIncreasing size={13} /> Session intelligence
            </span>
            <h1>Session analytics</h1>
            <p>
              A closer look at how Codex explored, reasoned, and changed{" "}
              <strong>{replay.session.title}</strong>.
            </p>
          </div>
          <dl>
            <div><dt>Started</dt><dd>{formatTime(replay.session.startedAt)}</dd></div>
            <div><dt>Source</dt><dd>{replay.session.filename}</dd></div>
          </dl>
        </header>

        <section className="analytics-metrics">
          <Metric icon={Clock3} label="Duration" value={duration} note={`${replay.stats.turns} user turns`} />
          <Metric icon={Wrench} label="Tool calls" value={compactNumber(replay.stats.toolCalls)} note={`${totals.uniqueTools} unique tools`} tone="green" />
          <Metric icon={Files} label="Files changed" value={compactNumber(totals.editedFiles)} note={`${compactNumber(totals.additions + totals.deletions)} lines touched`} tone="blue" />
          <Metric icon={Braces} label="Token usage" value={compactNumber(totals.tokens)} note="Total session context" tone="violet" />
        </section>

        <section className="analytics-panel pattern-panel pattern-feature">
          <PanelHeading
            icon={Gauge}
            title="Working pattern"
            copy="The balance between conversation, action, and tool usage"
            badge={`${toolShare}% action driven`}
          />
          <div className="pattern-body">
            <section className="pattern-breakdown">
              <h3>Event mix</h3>
              <div className="event-breakdown-content">
                <div
                  className="tool-share-ring"
                  style={{ "--tool-share": `${toolShare * 3.6}deg` }}
                >
                  <div><strong>{toolShare}%</strong><span>tool events</span></div>
                </div>
                <dl className="pattern-stats">
                  <div><dt><Wrench size={13} /> Tool calls</dt><dd>{replay.stats.toolCalls}</dd></div>
                  <div><dt><MessageSquareText size={13} /> Messages</dt><dd>{replay.stats.messages}</dd></div>
                  <div><dt><ArrowUpRight size={13} /> Repeated calls</dt><dd>{totals.exactRepeats}</dd></div>
                  <div><dt><FileCode2 size={13} /> Files inspected</dt><dd>{totals.uniqueReads}</dd></div>
                </dl>
              </div>
            </section>
            <ToolUsageDonut items={analytics.toolRanking} onSelect={openTool} />
          </div>
        </section>

        <section className="analytics-two-column file-analytics">
          <article className="analytics-panel">
            <PanelHeading
              icon={FileCode2}
              title="Most read files"
              copy="Explicit file reads detected in tool calls"
              badge={`${totals.uniqueReads} files`}
            />
            <Ranking items={analytics.readFiles} empty="No explicit file reads detected." />
          </article>
          <article className="analytics-panel">
            <PanelHeading
              icon={FilePenLine}
              title="Most edited files"
              copy="Ranked by the number of patch operations"
              badge={`+${compactNumber(totals.additions)} −${compactNumber(totals.deletions)}`}
            />
            <Ranking
              items={analytics.editedFiles}
              empty="No file edits were recorded."
              renderMeta={(item) => (
                <small className="change-meta">+{item.additions} −{item.deletions}</small>
              )}
            />
          </article>
        </section>
      </div>
    </main>
  );
}
