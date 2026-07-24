import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

export function useSearchParamState(name, defaultValue = "", { replace = true } = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const value = searchParams.get(name) ?? defaultValue;

  const setValue = useCallback((nextValue) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      const currentValue = current.get(name) ?? defaultValue;
      const resolved = typeof nextValue === "function"
        ? nextValue(currentValue)
        : nextValue;
      const stringValue = resolved == null ? "" : String(resolved);
      if (!stringValue || stringValue === defaultValue) next.delete(name);
      else next.set(name, stringValue);
      return next;
    }, { replace });
  }, [defaultValue, name, replace, setSearchParams]);

  return [value, setValue];
}
