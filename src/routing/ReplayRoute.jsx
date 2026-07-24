import React from "react";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ReplayApp } from "../replay-ui/ReplayApp";
import { useRouteReplay } from "./useRouteReplay";

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
  const { replay, error } = useRouteReplay(params, transientReplay);

  if (!replay) return <RouteState error={error} onBack={() => navigate("/")} />;
  return (
    <ReplayApp
      replay={replay}
      onClose={() => navigate("/")}
      onAnalytics={() => navigate(`/analytics?${params.toString()}`)}
    />
  );
}
