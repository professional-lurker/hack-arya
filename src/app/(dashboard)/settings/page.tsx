import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  const user = session?.user ?? {
    name: "Admin",
    email: "admin@aisandbox.dev",
    role: "SUPER_ADMIN",
  };

  return (
    <div className="animate-fade-in space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <Settings className="w-6 h-6 text-[hsl(var(--muted-foreground))]" />
        <h1 className="text-2xl font-bold text-white">Settings</h1>
      </div>
      <Card className="border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <CardHeader><CardTitle className="text-sm text-white">Account</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "Name", value: user.name },
            { label: "Email", value: user.email },
            { label: "Role", value: user.role },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-[hsl(var(--border))] last:border-0">
              <span className="text-sm text-[hsl(var(--muted-foreground))]">{label}</span>
              <span className="text-sm text-white font-medium">{value}</span>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <CardHeader><CardTitle className="text-sm text-white">Privacy</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Prompt content is <strong className="text-white">not stored</strong> by default.
            Only metadata (tokens, latency, status) is logged. Request logs are retained for {process.env.LOG_RETENTION_DAYS ?? 30} days.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
