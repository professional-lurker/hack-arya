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

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error?.message ?? "Registration failed", variant: "destructive" });
        return;
      }
      // Auto sign in after registration
      const result = await signIn("credentials", {
        email: form.email, password: form.password, redirect: false,
      });
      if (!result?.error) { router.push("/dashboard"); }
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Create Account</h1>
          <p className="text-[hsl(var(--muted-foreground))] text-sm mt-1">Start testing AI integrations for free</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name" className="text-[hsl(var(--muted-foreground))] text-xs">Full Name</Label>
            <Input
              id="name" type="text" required
              className="mt-1 bg-[hsl(var(--card))] border-[hsl(var(--border))] text-white"
              placeholder="Alex Developer"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
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
              id="password" type="password" required minLength={8}
              className="mt-1 bg-[hsl(var(--card))] border-[hsl(var(--border))] text-white"
              placeholder="Min. 8 chars, 1 uppercase, 1 number"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Account"}
          </Button>
        </form>

        <p className="text-center text-sm text-[hsl(var(--muted-foreground))] mt-4">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-400 hover:text-blue-300">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
