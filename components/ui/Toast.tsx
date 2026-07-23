"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { Check, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastKind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastCtx = createContext<(kind: ToastKind, message: string) => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = ++counter;
    setItems((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3200);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium shadow-[var(--shadow-lg)] backdrop-blur",
              t.kind === "success" && "border-sucesso/30 bg-sucesso/10 text-[#16a34a] dark:text-[#4ade80]",
              t.kind === "error" && "border-erro/30 bg-erro/10 text-[#dc2626] dark:text-[#f87171]",
              t.kind === "info" && "border-line bg-bg-elev text-fg"
            )}
          >
            <span className="grid size-5 place-items-center rounded-full bg-current/15">
              {t.kind === "success" ? (
                <Check className="size-3.5" />
              ) : t.kind === "error" ? (
                <AlertTriangle className="size-3.5" />
              ) : (
                <X className="size-3.5" />
              )}
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
