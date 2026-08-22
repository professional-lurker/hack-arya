"use client";

import { useState, useEffect } from "react";
import { BarChart3, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

interface Provider { id: string; name: string; displayName: string; models: { modelId: string; displayName: string }[] }
interface CompareResult {
  provider: string; displayName: string; model: string;
  success: boolean; content?: string; error?: string;
  latencyMs: number; inputTokens: number; outputTokens: number;
}

export default function ComparisonPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [prompt, setPrompt] = useState("Summarize what recursion means in programming in exactly 2 sentences.");
  const [apiKey, setApiKey] = useState("");
  const [results, setResults] = useState<CompareResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/v1/providers").then(r => r.json()).then(d => setProviders(d.providers ?? []));
  }, []);

  const handleCompare = async () => {
    if (!apiKey.trim()) { toast({ title: "Enter your API key", variant: "destructive" }); return; }
    if (!prompt.trim()) { toast({ title: "Enter a test prompt", variant: "destructive" }); return; }
    if (providers.length < 2) { toast({ title: "Need at least 2 providers enabled", variant: "destructive" }); return; }

    setLoading(true);
    setResults([]);

    const runs = await Promise.allSettled(
      providers.map(async (provider) => {
        const model = provider.models[0]?.modelId;
        if (!model) return null;
        const start = Date.now();
        try {
          const res = await fetch("/api/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], maxTokens: 200 }),
          });
          const data = await res.json();
          return {
            provider: provider.name,
            displayName: provider.displayName,
            model,
            success: res.ok && !data.error,
            content: data.choices?.[0]?.message?.content,
            error: data.error?.message,
            latencyMs: data.sandbox?.latency_ms ?? (Date.now() - start),
            inputTokens: data.usage?.prompt_tokens ?? 0,
            outputTokens: data.usage?.completion_tokens ?? 0,
          } as CompareResult;
        } catch {
          return { provider: provider.name, displayName: provider.displayName, model, success: false, error: "Request failed", latencyMs: Date.now() - start, inputTokens: 0, outputTokens: 0 } as CompareResult;
        }
      })
    );

    setResults(runs.filter(r => r.status === "fulfilled" && r.value).map(r => (r as PromiseFulfilledResult<CompareResult>).value));
    setLoading(false);
  };

  const fastest = results.length > 0 ? results.reduce((a, b) => a.latencyMs < b.latencyMs ? a : b) : null;

  return (
    <div className="animate-fade-in space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-violet-400" /> Provider Comparison
        </h1>
        <p className="text-[hsl(var(--muted-foreground))] mt-1 text-sm">
          Run the same prompt across all configured providers simultaneously.
        </p>
      </div>

      <Card className="border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <CardContent className="pt-5 space-y-4">
          <div>
            <Label className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider">API Key</Label>
            <input
              type="password"
              placeholder="tmp_xxxxxxxxx"
              className="w-full mt-1 bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded-lg px-3 py-2 text-green-400 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Test Prompt</Label>
            <textarea
              className="w-full mt-1 bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows={3}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handleCompare} disabled={loading || providers.length === 0} className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Comparing...</> : <><Send className="w-4 h-4" /> Compare {providers.length} Providers</>}
            </Button>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              This will use {providers.length} request(s) from your quota.
            </p>
          </div>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <>
          {/* Summary table */}
          <Card className="border-[hsl(var(--border))] bg-[hsl(var(--card))]">
            <CardHeader><CardTitle className="text-sm text-white">Results Summary</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[hsl(var(--border))]">
                    {["Provider", "Model", "Status", "Latency", "Input Tokens", "Output Tokens"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[hsl(var(--muted-foreground))] font-medium uppercase tracking-wider text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.provider} className="border-b border-[hsl(var(--border))]">
                      <td className="px-4 py-3 font-medium text-white">{r.displayName}</td>
                      <td className="px-4 py-3 font-mono text-blue-400">{r.model}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={r.success ? "text-green-400 border-green-400/30 bg-green-400/10 text-[10px]" : "text-red-400 border-red-400/30 bg-red-400/10 text-[10px]"}>
                          {r.success ? "Success" : "Failed"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-white">
                        {r.latencyMs}ms
                        {fastest?.provider === r.provider && r.success && (
                          <span className="ml-2 text-[10px] text-green-400">⚡ Fastest</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-white">{r.inputTokens}</td>
                      <td className="px-4 py-3 text-white">{r.outputTokens}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Individual responses */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.map((r) => (
              <Card key={r.provider} className="border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm text-white">{r.displayName}</CardTitle>
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{r.latencyMs}ms</span>
                  </div>
                </CardHeader>
                <CardContent>
                  {r.success ? (
                    <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">{r.content}</p>
                  ) : (
                    <p className="text-sm text-red-400">{r.error}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
