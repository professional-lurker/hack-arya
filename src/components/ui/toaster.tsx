"use client";

import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80">
      {toasts
        .filter((t) => t.open)
        .map((t) => (
          <div
            key={t.id}
            className={`rounded-lg border px-4 py-3 shadow-lg text-sm transition-all animate-fade-in ${
              t.variant === "destructive"
                ? "bg-red-950 border-red-700 text-red-200"
                : "bg-[hsl(var(--card))] border-[hsl(var(--border))] text-white"
            }`}
          >
            {t.title && <p className="font-medium">{t.title}</p>}
            {t.description && (
              <p className="text-[hsl(var(--muted-foreground))] text-xs mt-0.5">{t.description}</p>
            )}
          </div>
        ))}
    </div>
  );
}
