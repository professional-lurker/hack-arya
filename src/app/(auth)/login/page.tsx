"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });
      if (result?.error) {
        toast({ title: "Invalid email or password", variant: "destructive" });
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async (email: string, password: string) => {
    setForm({ email, password });
    setLoading(true);
    const result = await signIn("credentials", { email, password, redirect: false });
    if (!result?.error) { router.push("/dashboard"); router.refresh(); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">AI Sandbox</h1>
          <p className="text-[hsl(var(--muted-foreground))] text-sm mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email" className="text-[hsl(var(--muted-foreground))] text-xs">Email</Label>
            <Input
              id="email" type="email" required
              className="mt-1 bg-[hsl(var(--card))] border-[hsl(var(--border))] text-white"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="password" className="text-[hsl(var(--muted-foreground))] text-xs">Password</Label>
            <Input
              id="password" type="password" required
              className="mt-1 bg-[hsl(var(--card))] border-[hsl(var(--border))] text-white"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
          </Button>
        </form>

        {/* Demo shortcuts */}
        <div className="mt-4 border border-[hsl(var(--border))] rounded-xl p-3 space-y-2">
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider text-center mb-2">Demo Accounts</p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-white"
              onClick={() => handleDemo("demo@aisandbox.dev", "Demo@12345!")}
            >
              👤 Demo User
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-white"
              onClick={() => handleDemo("admin@aisandbox.dev", "Admin@123!")}
            >
              🛡 Admin
            </Button>
          </div>
        </div>

        <p className="text-center text-sm text-[hsl(var(--muted-foreground))] mt-4">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-blue-400 hover:text-blue-300">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
