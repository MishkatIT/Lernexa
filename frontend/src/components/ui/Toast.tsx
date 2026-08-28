"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Tone = "neutral" | "danger";
type Toast = { id: number; message: string; tone: Tone };

type ToastApi = {
  /** Confirmation after an action. Success is neutral ink — green is reserved. */
  toast: (message: string, opts?: { tone?: Tone }) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const DURATION = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback<ToastApi["toast"]>(
    (message, opts) => {
      const id = Date.now() + Math.random();
      // One at a time — a new toast replaces whatever's showing.
      setToasts([{ id, message, tone: opts?.tone ?? "neutral" }]);
      const timer = setTimeout(() => dismiss(id), DURATION);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach(clearTimeout);
  }, []);

  const api = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-end gap-2 p-4 sm:p-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex max-w-sm items-start gap-3 rounded-md border bg-paper-raised px-3.5 py-2.5 text-small text-ink-900 shadow-[var(--shadow-overlay)] ${
              t.tone === "danger"
                ? "border-l-[3px] border-danger"
                : "border-ink-200"
            }`}
          >
            <span className="flex-1">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="-mr-1 -mt-0.5 shrink-0 rounded-sm px-1 text-ink-500 transition-colors hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Never throw for a non-critical convenience — degrade to a no-op.
    return { toast: () => {} };
  }
  return ctx;
}
