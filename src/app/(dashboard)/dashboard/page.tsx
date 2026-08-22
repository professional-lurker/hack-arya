import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Key, Activity, Zap, TrendingUp, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

async function getDashboardData(userId: string) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [activeKeys, totalRequests, todayRequests, successRequests, recentRequests, tokenSum, latencyData] =
    await Promise.all([
      prisma.sandboxKey.findMany({
        where: { userId, status: { in: ["ACTIVE", "CREATED"] }, expiresAt: { gt: now } },
        include: { provider: { select: { displayName: true } } },
        orderBy: { expiresAt: "asc" },
        take: 5,
      }),
      prisma.apiRequest.count({ where: { userId } }),
      prisma.apiRequest.count({ where: { userId, startedAt: { gte: todayStart } } }),
      prisma.apiRequest.count({ where: { userId, status: "SUCCESS" } }),
      prisma.apiRequest.findMany({
        where: { userId },
        include: { provider: { select: { displayName: true } } },
        orderBy: { startedAt: "desc" },
        take: 8,
      }),
      prisma.apiRequest.aggregate({ where: { userId }, _sum: { totalTokens: true } }),
      prisma.apiRequest.aggregate({
        where: { userId, latencyMs: { not: null } },
        _avg: { latencyMs: true },
      }),
    ]);

  return {
    activeKeys,
    totalRequests,
    todayRequests,
    errorRate: totalRequests > 0 ? (((totalRequests - successRequests) / totalRequests) * 100).toFixed(1) : "0",
    totalTokens: tokenSum._sum.totalTokens ?? 0,
    avgLatencyMs: Math.round(latencyData._avg.latencyMs ?? 0),
    recentRequests,
  };
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  SUCCESS: { label: "Success", color: "text-green-400" },
  ERROR: { label: "Error", color: "text-red-400" },
  RATE_LIMITED: { label: "Rate Limited", color: "text-yellow-400" },
  QUOTA_EXCEEDED: { label: "Quota Exceeded", color: "text-orange-400" },
  TIMEOUT: { label: "Timeout", color: "text-red-400" },
  AUTH_FAILED: { label: "Auth Failed", color: "text-red-400" },
  PROVIDER_ERROR: { label: "Provider Error", color: "text-red-400" },
};

import { IntegrationSnippet } from "@/components/integration-snippet";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const data = await getDashboardData(session.user.id);
  const activeKeyStr = data.activeKeys[0] ? `${data.activeKeys[0].keyPrefix}...` : "tmp_your_key_here";

  const statsCards = [
    {
      title: "Active Keys",
      value: data.activeKeys.length,
      icon: Key,
      color: "from-blue-500/20 to-blue-600/10",
      iconColor: "text-blue-400",
    },
    {
      title: "Requests Today",
      value: data.todayRequests.toLocaleString(),
      icon: Activity,
      color: "from-violet-500/20 to-violet-600/10",
      iconColor: "text-violet-400",
    },
    {
      title: "Tokens Used",
      value: data.totalTokens >= 1000
        ? `${(data.totalTokens / 1000).toFixed(1)}K`
        : data.totalTokens,
      icon: Zap,
      color: "from-emerald-500/20 to-emerald-600/10",
      iconColor: "text-emerald-400",
    },
    {
      title: "Avg Latency",
      value: data.avgLatencyMs > 0 ? `${(data.avgLatencyMs / 1000).toFixed(2)}s` : "—",
      icon: TrendingUp,
      color: "from-amber-500/20 to-amber-600/10",
      iconColor: "text-amber-400",
    },
  ];

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Welcome back, {session.user.name?.split(" ")[0]} 👋
        </h1>
        <p className="text-[hsl(var(--muted-foreground))] mt-1">
          Here&apos;s what&apos;s happening with your AI integrations.
        </p>
      </div>

      {/* Direct .env & Integration Syntax Snippet */}
      <IntegrationSnippet apiKey={activeKeyStr} model="gemini-3.5-flash" />

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((card) => (
          <Card key={card.title} className={`bg-gradient-to-br ${card.color} border-[hsl(var(--border))] glass`}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                {card.title}
              </CardTitle>
              <card.icon className={`w-4 h-4 ${card.iconColor}`} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-white">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Keys */}
        <Card className="border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-sm font-semibold text-white">Active API Keys</CardTitle>
            <a href="/keys" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
              View all →
            </a>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.activeKeys.length === 0 ? (
              <div className="text-center py-6">
                <Key className="w-8 h-8 text-[hsl(var(--muted-foreground))] mx-auto mb-2" />
                <p className="text-sm text-[hsl(var(--muted-foreground))]">No active keys</p>
                <a
                  href="/keys"
                  className="inline-block mt-3 text-xs text-blue-400 hover:text-blue-300 border border-blue-400/30 rounded-md px-3 py-1.5 transition-colors"
                >
                  Generate your first key
                </a>
              </div>
            ) : (
              data.activeKeys.map((key) => {
                const pct = (key.requestsUsed / key.maxRequests) * 100;
                const barClass = pct > 80 ? "danger" : pct > 60 ? "warning" : "safe";
                const timeLeft = formatDistanceToNow(key.expiresAt, { addSuffix: true });

                return (
                  <a
                    key={key.id}
                    href={`/keys/${key.id}`}
                    className="block p-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] hover:bg-[hsl(var(--muted)/0.5)] transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium text-white truncate max-w-[180px]">
                          {key.name ?? "Unnamed Key"}
                        </p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">
                          {key.provider.displayName} · expires {timeLeft}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-green-400 border-green-400/30 bg-green-400/10 text-[10px] shrink-0">
                        ACTIVE
                      </Badge>
                    </div>
                    <div className="quota-bar">
                      <div
                        className={`quota-bar-fill ${barClass}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">
                      {key.requestsUsed}/{key.maxRequests} requests
                    </p>
                  </a>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Recent Requests */}
        <Card className="border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-sm font-semibold text-white">Recent Requests</CardTitle>
            <a href="/requests" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
              View all →
            </a>
          </CardHeader>
          <CardContent>
            {data.recentRequests.length === 0 ? (
              <div className="text-center py-6">
                <Activity className="w-8 h-8 text-[hsl(var(--muted-foreground))] mx-auto mb-2" />
                <p className="text-sm text-[hsl(var(--muted-foreground))]">No requests yet</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                  Start by using your API key in the playground.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.recentRequests.map((req) => {
                  const cfg = STATUS_CONFIG[req.status] ?? { label: req.status, color: "text-gray-400" };
                  return (
                    <div key={req.requestId} className="flex items-center gap-3 py-2 border-b border-[hsl(var(--border))] last:border-0">
                      {req.status === "SUCCESS" ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white font-mono truncate">{req.requestId}</p>
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                          {req.provider?.displayName ?? "—"} · {req.modelId}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-[10px] font-medium ${cfg.color}`}>{cfg.label}</p>
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                          {req.latencyMs ? `${req.latencyMs}ms` : "—"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Error rate / health summary */}
      <Card className="border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <CardContent className="py-4">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <span className="status-dot operational pulse-active" />
              <span className="text-sm text-[hsl(var(--muted-foreground))]">
                <span className="text-white font-medium">{100 - parseFloat(data.errorRate)}%</span> Success Rate
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
              <span className="text-sm text-[hsl(var(--muted-foreground))]">
                <span className="text-white font-medium">{data.avgLatencyMs}ms</span> avg latency
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
              <span className="text-sm text-[hsl(var(--muted-foreground))]">
                <span className="text-white font-medium">{data.totalRequests.toLocaleString()}</span> total requests
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
