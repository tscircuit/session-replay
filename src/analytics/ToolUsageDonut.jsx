import React from "react";
import { ChevronRight } from "lucide-react";

const TOOL_COLORS = [
  "#e0b84f",
  "#c8d2d6",
  "#c1845e",
  "#8bb9c4",
  "#a68be0",
  "#5db99a",
  "#d87891",
  "#d9965c",
];

function activateWithKeyboard(event, action) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  action();
}

function buildSegments(items) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  let offset = 0;
  return items.map((item, index) => {
    const share = total ? (item.count / total) * 100 : 0;
    const segment = {
      color: TOOL_COLORS[index % TOOL_COLORS.length],
      item,
      offset,
      share,
    };
    offset += share;
    return segment;
  });
}

export function ToolUsageDonut({ items, onSelect }) {
  const segments = buildSegments(items);
  const total = items.reduce((sum, item) => sum + item.count, 0);

  return (
    <section className="pattern-breakdown tool-breakdown">
      <h3>Most used tools</h3>
      {items.length ? (
        <div className="tool-breakdown-content">
          <div className="tool-donut">
            <svg viewBox="0 0 120 120" aria-label="Tool usage chart">
              <circle className="tool-donut-base" cx="60" cy="60" r="50" />
              {segments.map(({ color, item, offset, share }) => {
                const open = () => onSelect(item);
                return (
                  <g
                    className="tool-donut-segment"
                    key={item.label}
                    role="link"
                    tabIndex={0}
                    aria-label={`Open ${item.label} analytics, ${item.count} calls`}
                    onClick={open}
                    onKeyDown={(event) => activateWithKeyboard(event, open)}
                  >
                    <title>{item.label}: {item.count} calls</title>
                    <circle
                      className="tool-donut-arc"
                      cx="60"
                      cy="60"
                      r="50"
                      pathLength="100"
                      stroke={color}
                      strokeDasharray={`${share} ${100 - share}`}
                      strokeDashoffset={-offset}
                    />
                  </g>
                );
              })}
            </svg>
            <div><strong>{total}</strong><span>tool calls</span></div>
          </div>

          <div className="tool-donut-legend">
            {segments.map(({ color, item }) => (
              <button
                key={item.label}
                style={{ "--segment-color": color }}
                onClick={() => onSelect(item)}
                title={`Open ${item.label} analytics`}
              >
                <i />
                <strong>{item.label.replaceAll("_", " ")}</strong>
                <span>{item.count}</span>
                <ChevronRight size={12} />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="analytics-empty">No tools were used.</div>
      )}
    </section>
  );
}
