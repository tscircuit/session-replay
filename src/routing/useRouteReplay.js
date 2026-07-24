import { useEffect, useMemo, useState } from "react";
import { buildReplay, parseSessionText } from "../replay";
import { SAMPLE_SESSION } from "../sample";
import { sessionContentUrl } from "../import/sessionCatalog";

const demoReplay = buildReplay(SAMPLE_SESSION, "demo-session.jsonl");

function sourceFromParams(params) {
  const session = params.get("session");
  if (session) {
    const bundled = params.get("bundled") === "1";
    return {
      key: `${bundled ? "bundled" : "session"}:${session}`,
      session,
      bundled,
    };
  }
  if (params.get("demo") === "1") return { key: "demo", demo: true };
  return { key: "upload", upload: true };
}

export function useRouteReplay(params, transientReplay) {
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
    fetch(sessionContentUrl({
      path: source.session,
      origin: source.bundled ? "bundled" : "local",
    }), {
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
  }, [immediateReplay, source.bundled, source.key, source.session]);

  const replay = immediateReplay || (remote.key === source.key ? remote.replay : null);
  const error = source.upload && !immediateReplay
    ? "Uploaded files cannot be restored after the page is refreshed."
    : remote.key === source.key
      ? remote.error
      : "";

  return { replay, error };
}
