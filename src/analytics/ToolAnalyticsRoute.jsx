import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  Braces,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  FileCode2,
  Files,
  Gauge,
  LoaderCircle,
  Search,
  TerminalSquare,
  Wrench,
} from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { formatTime } from "../replay";
import { useRouteReplay } from "../routing/useRouteReplay";
import { Mark } from "../ui/Mark";
import { buildToolAnalytics } from "./sessionAnalytics";
import "../styles/tool-analytics.css";

function compactNumber(value) {
  return new Intl.NumberFormat(undefined, {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function DetailMetric({ icon: Icon, label, value, note }) {
  return (
    <article className="tool-detail-metric">
      <Icon size={15} />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function MiniRanking({ items, empty }) {
  if (!items.length) return <p className="tool-detail-empty">{empty}</p>;
  const maximum = items[0].count;
  return (
    <div className="tool-mini-ranking">
      {items.map((item) => (
        <div key={item.label}>
          <span title={item.label}>{item.label}</span>
          <b>{item.count}×</b>
          <i><em style={{ width: `${Math.max(5, (item.count / maximum) * 100)}%` }} /></i>
        </div>
      ))}
    </div>
  );
}

function ToolCall({ call }) {
  const [copied, setCopied] = useState(false);
  const copyPayload = async () => {
    await navigator.clipboard.writeText(call.payload);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <article className="tool-call-card">
      <header>
        <span>Call {String(call.number).padStart(2, "0")}</span>
        <time><Clock3 size={11} /> {formatTime(call.timestamp, "No timestamp")}</time>
      </header>
      <div className="tool-call-summary">
        <TerminalSquare size={14} />
        <code title={call.label}>{call.label}</code>
      </div>
      {call.files.length > 0 && (
        <div className="tool-call-files">
          {call.files.slice(0, 4).map((file) => <span key={file}>{file}</span>)}
          {call.files.length > 4 && <i>+{call.files.length - 4} more</i>}
        </div>
      )}
      <details>
        <summary><ChevronRight size={13} /> Inspect input payload</summary>
        <div className="payload-wrap">
          <button onClick={copyPayload} aria-label="Copy input payload">
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy"}
          </button>
          <pre>{call.payload}</pre>
        </div>
      </details>
    </article>
  );
}

function LoadingState({ error, onBack }) {
  return (
    <main className="route-state">
      {error ? (
        <>
          <strong>Could not open tool analytics</strong>
          <p>{error}</p>
          <button className="button" onClick={onBack}><ArrowLeft size={15} /> Back</button>
        </>
      ) : (
        <><LoaderCircle size={20} className="spinning" /> Loading tool activity…</>
      )}
    </main>
  );
}

export function ToolAnalyticsRoute({ transientReplay }) {
  const navigate = useNavigate();
  const { toolName = "" } = useParams();
  const [params] = useSearchParams();
  const { replay, error } = useRouteReplay(params, transientReplay);
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(12);
  const analytics = useMemo(
    () => replay ? buildToolAnalytics(replay, toolName) : null,
    [replay, toolName],
  );

  if (!replay || !analytics) {
    return <LoadingState error={error} onBack={() => navigate("/")} />;
  }

  const normalizedQuery = query.trim().toLowerCase();
  const filteredCalls = normalizedQuery
    ? analytics.calls.filter((call) =>
      `${call.label}\n${call.payload}\n${call.files.join("\n")}`
        .toLowerCase()
        .includes(normalizedQuery))
    : analytics.calls;
  const calls = filteredCalls.slice(0, visibleCount);
  const share = replay.stats.toolCalls
    ? Math.round((analytics.calls.length / replay.stats.toolCalls) * 100)
    : 0;

  return (
    <main className="analytics-page">
      <nav className="analytics-nav">
        <div className="analytics-brand">
          <button
            onClick={() => navigate(`/analytics?${params.toString()}`)}
            aria-label="Back to session analytics"
          >
            <ArrowLeft size={17} />
          </button>
          <Mark />
          <span>Codex Replay</span>
          <i />
          <b>Tool activity</b>
        </div>
        <button
          className="analytics-replay-button"
          onClick={() => navigate(`/replay?${params.toString()}`)}
        >
          Open replay
        </button>
      </nav>

      <div className="tool-detail-shell">
        <header className="tool-detail-hero">
          <button onClick={() => navigate(`/analytics?${params.toString()}`)}>
            Session analytics <ChevronRight size={12} />
          </button>
          <div>
            <span><Wrench size={18} /></span>
            <div>
              <small>Tool deep dive</small>
              <h1>{toolName.replaceAll("_", " ")}</h1>
              <p>Every recorded invocation, input payload, and affected file.</p>
            </div>
          </div>
        </header>

        <section className="tool-detail-metrics">
          <DetailMetric icon={Wrench} label="Total calls" value={compactNumber(analytics.calls.length)} note={`${share}% of all tool use`} />
          <DetailMetric icon={Braces} label="Unique inputs" value={compactNumber(analytics.uniqueInputs)} note="Normalized call payloads" />
          <DetailMetric icon={Files} label="Files touched" value={compactNumber(analytics.touchedFiles.length)} note="Explicitly reported by tool" />
          <DetailMetric icon={Gauge} label="Repeat rate" value={`${analytics.calls.length ? Math.round(((analytics.calls.length - analytics.uniqueInputs) / analytics.calls.length) * 100) : 0}%`} note="Calls using prior input" />
        </section>

        <section className="tool-detail-grid">
          <article className="tool-side-panel">
            <header><Braces size={15} /><div><h2>Common inputs</h2><p>Repeated call patterns</p></div></header>
            <MiniRanking items={analytics.commonInputs} empty="No inputs recorded." />
          </article>
          <article className="tool-side-panel">
            <header><FileCode2 size={15} /><div><h2>Touched files</h2><p>Files reported by this tool</p></div></header>
            <MiniRanking items={analytics.touchedFiles} empty="No touched files reported." />
          </article>
        </section>

        <section className="tool-call-explorer">
          <header>
            <div>
              <h2>Call explorer</h2>
              <p>Open any call to inspect the data passed into the tool.</p>
            </div>
            <label>
              <Search size={14} />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setVisibleCount(12);
                }}
                placeholder="Search calls or payloads"
              />
            </label>
          </header>
          <div className="tool-call-list">
            {calls.map((call) => <ToolCall call={call} key={call.id} />)}
            {!calls.length && <p className="tool-detail-empty">No matching calls.</p>}
          </div>
          {visibleCount < filteredCalls.length && (
            <button
              className="load-more-calls"
              onClick={() => setVisibleCount((count) => count + 12)}
            >
              Show more calls
            </button>
          )}
        </section>
      </div>
    </main>
  );
}
