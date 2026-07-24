import React, { useCallback, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { ImportScreen } from "./import/ImportScreen";
import { ReplayRoute } from "./routing/ReplayRoute";
import { AnalyticsRoute } from "./analytics/AnalyticsRoute";
import { ToolAnalyticsRoute } from "./analytics/ToolAnalyticsRoute";

function replaySourceKey(source) {
  if (source.session) {
    return `${source.bundled ? "bundled" : "session"}:${source.session}`;
  }
  if (source.demo) return "demo";
  return "upload";
}

export default function App() {
  const navigate = useNavigate();
  const [transientReplay, setTransientReplay] = useState(null);
  const [error, setError] = useState("");

  const openReplay = useCallback((replay, source = { upload: "1" }) => {
    const params = new URLSearchParams(source);
    setTransientReplay({ key: replaySourceKey(source), replay });
    navigate(`/replay?${params.toString()}`);
  }, [navigate]);

  return (
    <Routes>
      <Route
        path="/"
        element={<ImportScreen onLoad={openReplay} error={error} setError={setError} />}
      />
      <Route
        path="/replay"
        element={<ReplayRoute transientReplay={transientReplay} />}
      />
      <Route
        path="/analytics"
        element={<AnalyticsRoute transientReplay={transientReplay} />}
      />
      <Route
        path="/analytics/tool/:toolName"
        element={<ToolAnalyticsRoute transientReplay={transientReplay} />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
