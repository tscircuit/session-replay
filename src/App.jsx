import React, { useState } from "react";
import { ImportScreen } from "./import/ImportScreen";
import { ReplayApp } from "./replay-ui/ReplayApp";

export default function App() {
  const [replay, setReplay] = useState(null);
  const [error, setError] = useState("");
  return replay ? (
    <ReplayApp replay={replay} onClose={() => setReplay(null)} />
  ) : (
    <ImportScreen onLoad={setReplay} error={error} setError={setError} />
  );
}
