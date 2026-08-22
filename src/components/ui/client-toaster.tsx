"use client";

import dynamic from "next/dynamic";

// Loaded client-side only: @base-ui/react/toast internally calls useContext()
// which throws during SSR prerender if no Provider is mounted above it.
// Using ssr:false ensures the Toaster never runs in the server prerender worker.
const Toaster = dynamic(
  () => import("@/components/ui/toaster").then((m) => m.Toaster),
  { ssr: false }
);

export function ClientToaster() {
  return <Toaster />;
}
