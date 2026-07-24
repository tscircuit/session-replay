export const SAMPLE_SESSION = [
  {
    type: "session_meta",
    payload: {
      id: "demo_7f3c",
      cwd: "/workspace/acme-dashboard",
      timestamp: "2026-07-24T09:30:00.000Z",
    },
  },
  {
    type: "event_msg",
    timestamp: "2026-07-24T09:30:04.000Z",
    payload: {
      type: "user_message",
      message: "Add a compact activity feed to the dashboard and make it feel at home in the existing interface.",
    },
  },
  {
    type: "event_msg",
    timestamp: "2026-07-24T09:30:08.000Z",
    payload: {
      type: "agent_message",
      message: "I’ll inspect the dashboard structure and existing visual tokens, then add the activity feed as a reusable component.",
    },
  },
  {
    type: "response_item",
    timestamp: "2026-07-24T09:30:11.000Z",
    payload: {
      type: "function_call",
      name: "exec_command",
      arguments: JSON.stringify({ cmd: "rg --files src && sed -n '1,220p' src/App.jsx" }),
    },
  },
  {
    type: "response_item",
    timestamp: "2026-07-24T09:30:34.000Z",
    payload: {
      type: "custom_tool_call",
      name: "apply_patch",
      input: `*** Begin Patch
*** Add File: src/components/ActivityFeed.jsx
+const events = [
+  { title: "Payment received", detail: "Acme Inc. · $2,400", time: "2m" },
+  { title: "New teammate", detail: "Maya joined Design", time: "18m" },
+  { title: "Report exported", detail: "June overview.pdf", time: "1h" },
+];
+
+export function ActivityFeed() {
+  return (
+    <section className="activity-card">
+      <header>
+        <h2>Recent activity</h2>
+        <button>View all</button>
+      </header>
+      <div className="activity-list">
+        {events.map((event) => (
+          <article key={event.title}>
+            <span className="activity-dot" />
+            <div><strong>{event.title}</strong><p>{event.detail}</p></div>
+            <time>{event.time}</time>
+          </article>
+        ))}
+      </div>
+    </section>
+  );
+}
*** Add File: src/components/activity.css
+.activity-card {
+  padding: 20px;
+  border: 1px solid var(--border);
+  border-radius: 16px;
+  background: var(--surface);
+}
+.activity-card header,
+.activity-card article {
+  display: flex;
+  align-items: center;
+}
+.activity-card header { justify-content: space-between; }
+.activity-list { margin-top: 18px; }
+.activity-card article { gap: 12px; padding: 12px 0; }
+.activity-card article + article { border-top: 1px solid var(--border); }
+.activity-dot { width: 8px; height: 8px; border-radius: 50%; background: #10a37f; }
+.activity-card p { color: var(--muted); margin-top: 3px; }
+.activity-card time { margin-left: auto; color: var(--muted); }
*** End Patch`,
    },
  },
  {
    type: "event_msg",
    timestamp: "2026-07-24T09:30:48.000Z",
    payload: {
      type: "agent_message",
      message: "The component is in place. I’m wiring it into the dashboard grid and then I’ll verify the layout at narrower widths.",
    },
  },
  {
    type: "response_item",
    timestamp: "2026-07-24T09:31:02.000Z",
    payload: {
      type: "custom_tool_call",
      name: "apply_patch",
      input: `*** Begin Patch
*** Update File: src/App.jsx
@@
 import { RevenueChart } from "./components/RevenueChart";
+import { ActivityFeed } from "./components/ActivityFeed";
+import "./components/activity.css";
@@
       <main className="dashboard-grid">
         <RevenueChart />
+        <ActivityFeed />
       </main>
*** End Patch`,
    },
  },
  {
    type: "response_item",
    timestamp: "2026-07-24T09:31:15.000Z",
    payload: {
      type: "function_call",
      name: "exec_command",
      arguments: JSON.stringify({ cmd: "npm test && npm run build" }),
    },
  },
  {
    type: "event_msg",
    timestamp: "2026-07-24T09:31:29.000Z",
    payload: {
      type: "agent_message",
      message: "The activity feed is implemented and the production build passes. It reuses the dashboard’s existing surface, border, and muted-text tokens, and collapses cleanly with the grid.",
    },
  },
];
