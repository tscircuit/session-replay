import React, { useEffect, useRef, useState } from "react";

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export function ResizeHandle({
  className = "",
  orientation,
  value,
  min,
  max,
  defaultValue,
  invert = false,
  disabled = false,
  label,
  onChange,
}) {
  const dragRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const resolveMax = () => typeof max === "function" ? max() : max;
  const updateValue = (next) => onChange(clamp(next, min, resolveMax()));

  const stopDragging = (target, pointerId) => {
    dragRef.current = null;
    setDragging(false);
    document.body.classList.remove("is-resizing");
    if (target?.hasPointerCapture?.(pointerId)) target.releasePointerCapture(pointerId);
  };

  useEffect(() => () => document.body.classList.remove("is-resizing"), []);

  const coordinate = (event) => orientation === "vertical" ? event.clientX : event.clientY;
  const direction = invert ? -1 : 1;
  const resolvedMax = resolveMax();

  return (
    <div
      className={`resize-handle ${orientation} ${dragging ? "dragging" : ""} ${className}`}
      role="separator"
      aria-label={label}
      aria-orientation={orientation}
      aria-valuemin={min}
      aria-valuemax={Math.round(resolvedMax)}
      aria-valuenow={Math.round(value)}
      aria-hidden={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onDoubleClick={() => !disabled && updateValue(defaultValue)}
      onPointerDown={(event) => {
        if (disabled || event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = { pointerId: event.pointerId, start: coordinate(event), value };
        setDragging(true);
        document.body.classList.add("is-resizing");
      }}
      onPointerMove={(event) => {
        if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
        event.preventDefault();
        const delta = (coordinate(event) - dragRef.current.start) * direction;
        updateValue(dragRef.current.value + delta);
      }}
      onPointerUp={(event) => stopDragging(event.currentTarget, event.pointerId)}
      onPointerCancel={(event) => stopDragging(event.currentTarget, event.pointerId)}
      onKeyDown={(event) => {
        if (disabled) return;
        const decreaseKey = orientation === "vertical" ? "ArrowLeft" : "ArrowUp";
        const increaseKey = orientation === "vertical" ? "ArrowRight" : "ArrowDown";
        if (event.key === "Home") {
          event.preventDefault();
          updateValue(defaultValue);
        } else if (event.key === decreaseKey || event.key === increaseKey) {
          event.preventDefault();
          const amount = event.shiftKey ? 40 : 10;
          const keyboardDirection = event.key === increaseKey ? 1 : -1;
          updateValue(value + keyboardDirection * direction * amount);
        }
      }}
      title={`${label}. Drag to resize; double-click to reset.`}
    />
  );
}
