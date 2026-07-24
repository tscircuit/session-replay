import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { buildReplay, parseSessionText } from "../replay";
import { ReplayApp } from "../replay-ui/ReplayApp";
import { SAMPLE_SESSION } from "../sample";

const demoReplay = buildReplay(SAMPLE_SESSION, "demo-session.jsonl");

function sourceFromParams(params) {
  const session = params.get("session");
  if (session) return { key: `session:${session}`, session };
  if (params.get("demo") === "1") return { key: "demo", demo: true };
  return { key: "upload", upload: true };
}

function RouteState({ error, onBack }) {
  return (
    <main className="route-state">
      {error ? (
        <>
          <strong>Could not open this replay</strong>
          <p>{error}</p>
          <button className="button" onClick={onBack}>
            <ArrowLeft size={15} /> Back to sessions
          </button>
        </>
      ) : (
        <><LoaderCircle size={20} className="spinning" /> Loading replay…</>
      )}
    </main>
  );
}

export function ReplayRoute({ transientReplay }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const source = useMemo(() => sourceFromParams(params), [params]);
  const immediateReplay = transientReplay?.key === source.key
    ? transientReplay.replay
    : source.demo
      ? demoReplay
      : null;
  const [remote, setRemote] = useState({ key: "", replay: null, error: "" });

  useEffect(() => {
    if (immediateReplay || !source.session) return undefined;
    const controller = new AbortController();
    setRemote({ key: source.key, replay: null, error: "" });
    fetch(`/api/session?path=${encodeURIComponent(source.session)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.ok) return response.text();
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Could not open that session.");
      })
      .then((raw) => {
        const replay = buildReplay(parseSessionText(raw), source.session.split("/").at(-1));
        setRemote({ key: source.key, replay, error: "" });
      })
      .catch((reason) => {
        if (reason?.name !== "AbortError") {
          setRemote({ key: source.key, replay: null, error: reason.message });
        }
      });
    return () => controller.abort();
  }, [immediateReplay, source.key, source.session]);

  const remoteReplay = remote.key === source.key ? remote.replay : null;
  const replay = immediateReplay || remoteReplay;
  const error = source.upload && !immediateReplay
    ? "Uploaded files cannot be restored after the page is refreshed."
    : remote.key === source.key
      ? remote.error
      : "";

  if (!replay) return <RouteState error={error} onBack={() => navigate("/")} />;
  return <ReplayApp replay={replay} onClose={() => navigate("/")} />;
}
