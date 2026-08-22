import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Activity, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNow } from "date-fns";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  SUCCESS:        { label: "Success",        color: "text-green-400",  bg: "bg-green-400/10 border-green-400/30" },
  ERROR:          { label: "Error",          color: "text-red-400",    bg: "bg-red-400/10 border-red-400/30" },
  RATE_LIMITED:   { label: "Rate Limited",   color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/30" },
  QUOTA_EXCEEDED: { label: "Quota Exceeded", color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/30" },
  TIMEOUT:        { label: "Timeout",        color: "text-red-400",    bg: "bg-red-400/10 border-red-400/30" },
  AUTH_FAILED:    { label: "Auth Failed",    color: "text-red-400",    bg: "bg-red-400/10 border-red-400/30" },
  PROVIDER_ERROR: { label: "Provider Error", color: "text-red-400",    bg: "bg-red-400/10 border-red-400/30" },
};

async function getRequests(userId: string) {
  return prisma.apiRequest.findMany({
    where: { userId },
    include: {
      provider: { select: { displayName: true } },
      sandboxKey: { select: { keyPrefix: true, name: true } },
    },
    orderBy: { startedAt: "desc" },
    take: 100,
  });
}

export default async function RequestsPage() {
  const session = await auth();
  const userId = session?.user?.id ?? "admin-default-user";

  const requests = await getRequests(userId);

  const successCount = requests.filter((r) => r.status === "SUCCESS").length;
  const successRate = requests.length > 0 ? ((successCount / requests.length) * 100).toFixed(1) : "0";
  const avgLatency = requests.filter((r) => r.latencyMs).reduce((acc, r) => acc + (r.latencyMs ?? 0), 0) /
    (requests.filter((r) => r.latencyMs).length || 1);

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Request Log</h1>
        <p className="text-[hsl(var(--muted-foreground))] mt-1 text-sm">
          Every API request proxied through AI Sandbox.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Requests", value: requests.length.toLocaleString() },
          { label: "Success Rate", value: `${successRate}%` },
          { label: "Avg Latency", value: `${(avgLatency / 1000).toFixed(2)}s` },
          { label: "Simulated", value: requests.filter((r) => r.wasSimulated).length },
        ].map(({ label, value }) => (
          <Card key={label} className="border-[hsl(var(--border))] bg-[hsl(var(--card))]">
            <CardContent className="py-4">
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider">{label}</p>
              <p className="text-xl font-bold text-white mt-1">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Request table */}
      <Card className="border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <CardHeader><CardTitle className="text-sm text-white">All Requests</CardTitle></CardHeader>
        <CardContent className="p-0">
          {requests.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-8 h-8 text-[hsl(var(--muted-foreground))] mx-auto mb-2" />
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No requests yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]">
                    {["Request ID", "Key", "Provider / Model", "Status", "Tokens", "Latency", "Time"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-medium uppercase tracking-wider text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => {
                    const cfg = STATUS_CONFIG[req.status] ?? { label: req.status, color: "text-gray-400", bg: "" };
                    return (
                      <tr key={req.requestId} className="border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--muted)/0.3)] transition-colors">
                        <td className="px-4 py-3 font-mono text-blue-400">{req.requestId}</td>
                        <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                          <span className="font-mono">{req.sandboxKey?.keyPrefix}...</span>
                          {req.sandboxKey?.name && <span className="block text-[10px] truncate max-w-[120px]">{req.sandboxKey.name}</span>}
                        </td>
                        <td className="px-4 py-3 text-white">
                          <span className="block">{req.provider?.displayName ?? "—"}</span>
                          <span className="text-[hsl(var(--muted-foreground))] font-mono text-[10px]">{req.modelId}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`flex items-center gap-1 ${cfg.color}`}>
                            {req.status === "SUCCESS" ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                            {cfg.label}
                          </span>
                          {req.wasSimulated && <span className="text-[10px] text-amber-400">[SIM]</span>}
                        </td>
                        <td className="px-4 py-3 text-white">{req.totalTokens ?? "—"}</td>
                        <td className="px-4 py-3 text-white">
                          {req.latencyMs ? `${req.latencyMs}ms` : "—"}
                        </td>
                        <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                          <span title={format(req.startedAt, "PPpp")}>
                            {formatDistanceToNow(req.startedAt, { addSuffix: true })}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
