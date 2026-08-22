/**
 * Simple toast hook — works with Base UI shadcn toast.
 * This is a lightweight implementation compatible with the new shadcn toast.
 */
"use client";

import * as React from "react";

export type ToastVariant = "default" | "destructive";

export interface ToastOptions {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

type ToastState = ToastOptions & { id: string; open: boolean };

const listeners: Array<(toasts: ToastState[]) => void> = [];
let toasts: ToastState[] = [];

function dispatch(newToasts: ToastState[]) {
  toasts = newToasts;
  listeners.forEach((l) => l(toasts));
}

let counter = 0;

export function toast(options: ToastOptions) {
  const id = String(++counter);
  const t: ToastState = { ...options, id, open: true };
  dispatch([...toasts, t]);

  const duration = options.duration ?? 4000;
  setTimeout(() => {
    dispatch(toasts.map((x) => (x.id === id ? { ...x, open: false } : x)));
    setTimeout(() => {
      dispatch(toasts.filter((x) => x.id !== id));
    }, 300);
  }, duration);

  return { id, dismiss: () => dispatch(toasts.filter((x) => x.id !== id)) };
}

export function useToast() {
  const [state, setState] = React.useState<ToastState[]>(toasts);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const idx = listeners.indexOf(setState);
      if (idx > -1) listeners.splice(idx, 1);
    };
  }, []);

  return { toasts: state, toast, dismiss: (id: string) => dispatch(toasts.filter((x) => x.id !== id)) };
}
