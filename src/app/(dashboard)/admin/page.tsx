import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Shield, Users, Key, Activity, AlertTriangle, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

const AUDIT_LABELS: Record<string, string> = {
  USER_CREATED: "User Created", KEY_GENERATED: "Key Generated", KEY_REVOKED: "Key Revoked",
  KEY_EXPIRED: "Key Expired", KEY_EXHAUSTED: "Key Exhausted", PROVIDER_ENABLED: "Provider Enabled",
  PROVIDER_DISABLED: "Provider Disabled", ADMIN_LOGIN: "Admin Login", ABUSE_DETECTED: "Abuse Detected",
  CONFIG_CHANGED: "Config Changed", USER_SUSPENDED: "User Suspended",
};

export default async function AdminPage() {
  const session = await auth();
  if (session && !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) redirect("/dashboard");

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [totalUsers, activeKeys, totalRequests, todayRequests, providers, auditLogs, allKeys] = await Promise.all([
    prisma.user.count(),
    prisma.sandboxKey.count({ where: { status: { in: ["ACTIVE", "CREATED"] }, expiresAt: { gt: now } } }),
    prisma.apiRequest.count(),
    prisma.apiRequest.count({ where: { startedAt: { gte: todayStart } } }),
    prisma.provider.findMany({ include: { models: { select: { isEnabled: true } }, _count: { select: { apiRequests: true } } } }),
    prisma.auditLog.findMany({ include: { actor: { select: { email: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.sandboxKey.findMany({
      include: { user: { select: { email: true } }, provider: { select: { displayName: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const tokenSum = await prisma.apiRequest.aggregate({ _sum: { totalTokens: true, estimatedCostUsd: true } });

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="w-6 h-6 text-violet-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          <p className="text-[hsl(var(--muted-foreground))] text-sm">Platform-wide monitoring and control.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Users", value: totalUsers, icon: Users, color: "text-blue-400" },
          { label: "Active Keys", value: activeKeys, icon: Key, color: "text-green-400" },
          { label: "Total Requests", value: totalRequests.toLocaleString(), icon: Activity, color: "text-violet-400" },
          { label: "Today's Requests", value: todayRequests.toLocaleString(), icon: RefreshCw, color: "text-amber-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-[hsl(var(--border))] bg-[hsl(var(--card))]">
            <CardContent className="py-4 flex items-center gap-3">
              <Icon className={`w-8 h-8 ${color} opacity-70`} />
              <div>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider">{label}</p>
                <p className="text-xl font-bold text-white">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Provider health */}
        <Card className="border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <CardHeader><CardTitle className="text-sm text-white">Provider Status</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {providers.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--muted)/0.3)] border border-[hsl(var(--border))]">
                <div className="flex items-center gap-3">
                  <span className={`status-dot ${p.healthStatus.toLowerCase()}`} />
                  <div>
                    <p className="text-sm font-medium text-white">{p.displayName}</p>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                      {p.models.filter((m) => m.isEnabled).length} models · {p._count.apiRequests} requests
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {p.isEnabled ? (
                    <Badge variant="outline" className="text-green-400 border-green-400/30 bg-green-400/10 text-[10px]">Enabled</Badge>
                  ) : (
                    <Badge variant="outline" className="text-gray-400 border-gray-400/30 bg-gray-400/10 text-[10px]">Disabled</Badge>
                  )}
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))] capitalize">{p.healthStatus.toLowerCase()}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Audit log */}
        <Card className="border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <CardHeader><CardTitle className="text-sm text-white">Audit Log</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {auditLogs.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-4">No audit events yet.</p>
            ) : auditLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 py-1.5 border-b border-[hsl(var(--border))] last:border-0">
                <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white">{AUDIT_LABELS[log.action] ?? log.action}</p>
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                    {log.actor?.email ?? "System"} · {formatDistanceToNow(log.createdAt, { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* All keys table */}
      <Card className="border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <CardHeader><CardTitle className="text-sm text-white">Recent Keys (All Users)</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]">
                {["User", "Key", "Provider", "Status", "Usage", "Expires"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium uppercase tracking-wider text-[10px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allKeys.map((key) => (
                <tr key={key.id} className="border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--muted)/0.2)] transition-colors">
                  <td className="px-4 py-2 text-[hsl(var(--muted-foreground))]">{key.user.email}</td>
                  <td className="px-4 py-2 font-mono text-blue-400">{key.keyPrefix}...</td>
                  <td className="px-4 py-2 text-white">{key.provider.displayName}</td>
                  <td className="px-4 py-2">
                    <Badge variant="outline" className="text-[10px]">{key.status}</Badge>
                  </td>
                  <td className="px-4 py-2 text-white">{key.requestsUsed}/{key.maxRequests}</td>
                  <td className="px-4 py-2 text-[hsl(var(--muted-foreground))]">
                    {formatDistanceToNow(key.expiresAt, { addSuffix: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
