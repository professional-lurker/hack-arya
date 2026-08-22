"use client";

import { useState, useEffect, useRef } from "react";
import { FlaskConical, Send, Copy, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

interface Provider { id: string; name: string; displayName: string; models: { modelId: string; displayName: string }[] }
interface RequestResult {
  success: boolean; content?: string; error?: string;
  latencyMs: number; inputTokens: number; outputTokens: number; totalTokens: number;
  requestId?: string; requestsRemaining?: number; tokensRemaining?: number; status: string;
}

const inputCls = "w-full bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500";
const selectCls = `${inputCls} appearance-none`;
const labelCls = "block text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1";

export default function PlaygroundPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("You are a helpful AI assistant.");
  const [userPrompt, setUserPrompt] = useState("Explain how binary search works in simple terms.");
  const [temperature, setTemperature] = useState("0.7");
  const [maxTokens, setMaxTokens] = useState("512");
  const [result, setResult] = useState<RequestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const responseRef = useRef<HTMLDivElement>(null);

  const selectedProvider = providers.find(p => p.id === selectedProviderId);

  useEffect(() => {
    fetch("/api/v1/providers").then(r => r.json()).then(d => {
      const list: Provider[] = d.providers ?? [];
      setProviders(list);
      if (list.length) {
        setSelectedProviderId(list[0].id);
        setSelectedModel(list[0].models?.[0]?.modelId ?? "");
      }
    });
  }, []);

  const handleProviderChange = (id: string) => {
    setSelectedProviderId(id);
    const p = providers.find(p => p.id === id);
    setSelectedModel(p?.models?.[0]?.modelId ?? "");
  };

  const handleRun = async () => {
    if (!apiKey.trim()) { toast({ title: "Enter your tmp_ API key", variant: "destructive" }); return; }
    if (!userPrompt.trim()) { toast({ title: "Enter a prompt", variant: "destructive" }); return; }
    if (!selectedModel) { toast({ title: "Select a model", variant: "destructive" }); return; }

    setLoading(true); setResult(null);
    const t0 = Date.now();

    try {
      const res = await fetch("/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey.trim()}` },
        body: JSON.stringify({
          model: selectedModel,
          messages: [{ role: "user", content: userPrompt }],
          systemPrompt: systemPrompt || undefined,
          temperature: parseFloat(temperature),
          maxTokens: parseInt(maxTokens),
        }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setResult({ success: false, error: data.error?.message ?? "Request failed",
          latencyMs: Date.now() - t0, inputTokens: 0, outputTokens: 0, totalTokens: 0, status: data.error?.type ?? "ERROR" });
      } else {
        setResult({
          success: true, content: data.choices?.[0]?.message?.content ?? "",
          latencyMs: data.sandbox?.latency_ms ?? (Date.now() - t0),
          inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: data.usage?.completion_tokens ?? 0,
          totalTokens: data.usage?.total_tokens ?? 0, requestId: data.sandbox?.request_id,
          requestsRemaining: data.sandbox?.requests_remaining, tokensRemaining: data.sandbox?.tokens_remaining,
          status: "SUCCESS",
        });
        setTimeout(() => responseRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
    } catch {
      setResult({ success: false, error: "Network error", latencyMs: Date.now() - t0, inputTokens: 0, outputTokens: 0, totalTokens: 0, status: "ERROR" });
    } finally { setLoading(false); }
  };

  return (
    <div className="animate-fade-in space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <FlaskConical className="w-6 h-6 text-blue-400" /> Playground
        </h1>
        <p className="text-[hsl(var(--muted-foreground))] mt-1 text-sm">Test AI integrations directly with your temporary key.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config */}
        <div className="space-y-4">
          <Card className="border-[hsl(var(--border))] bg-[hsl(var(--card))]">
            <CardHeader><CardTitle className="text-sm text-white">Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className={labelCls}>API Key</label>
                <input type="password" placeholder="tmp_xxxxxxxxx" className={`${inputCls} text-green-400 font-mono`}
                  value={apiKey} onChange={e => setApiKey(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Provider</label>
                <select className={selectCls} value={selectedProviderId} onChange={e => handleProviderChange(e.target.value)}>
                  {providers.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Model</label>
                <select className={selectCls} value={selectedModel} onChange={e => setSelectedModel(e.target.value)}>
                  {(selectedProvider?.models ?? []).map(m => <option key={m.modelId} value={m.modelId}>{m.displayName}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Temperature: {temperature}</label>
                <input type="range" min="0" max="2" step="0.1" value={temperature}
                  onChange={e => setTemperature(e.target.value)} className="w-full mt-1 accent-blue-500" />
              </div>
              <div>
                <label className={labelCls}>Max Tokens</label>
                <input type="number" className={inputCls} value={maxTokens} onChange={e => setMaxTokens(e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-[hsl(var(--border))] bg-[hsl(var(--card))]">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider">System Prompt</CardTitle></CardHeader>
            <CardContent>
              <textarea className={inputCls} rows={2} value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} />
            </CardContent>
          </Card>

          <Card className="border-[hsl(var(--border))] bg-[hsl(var(--card))]">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider">User Prompt</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <textarea className={inputCls} rows={4} value={userPrompt}
                onChange={e => setUserPrompt(e.target.value)} placeholder="Enter your test prompt here..." />
              <Button onClick={handleRun} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Running...</> : <><Send className="w-4 h-4" /> Run Test</>}
              </Button>
            </CardContent>
          </Card>

          {result && (
            <Card ref={responseRef} className={`border-[hsl(var(--border))] ${!result.success ? "bg-red-950/20 border-red-500/20" : "bg-[hsl(var(--card))]"}`}>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Response</CardTitle>
                  <Badge variant="outline" className={result.success ? "text-green-400 border-green-400/30 bg-green-400/10 text-[10px]" : "text-red-400 border-red-400/30 bg-red-400/10 text-[10px]"}>
                    {result.status}
                  </Badge>
                </div>
                {result.success && result.content && (
                  <button onClick={async () => { await navigator.clipboard.writeText(result.content!); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                    className="text-[hsl(var(--muted-foreground))] hover:text-white transition-colors p-1">
                    {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {result.success ? (
                  <div className="bg-[hsl(var(--muted))] rounded-lg p-4 text-sm text-white whitespace-pre-wrap leading-relaxed">{result.content}</div>
                ) : (
                  <div className="bg-red-950/30 rounded-lg p-4 text-sm text-red-300 font-mono">{result.error}</div>
                )}
                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-[hsl(var(--border))]">
                  {[
                    { label: "Latency", value: `${(result.latencyMs/1000).toFixed(2)}s` },
                    { label: "Input", value: result.inputTokens },
                    { label: "Output", value: result.outputTokens },
                    { label: "Total", value: result.totalTokens },
                  ].map(({ label, value }) => (
                    <div key={label} className="text-center">
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider">{label}</p>
                      <p className="text-sm font-semibold text-white mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
                {result.requestsRemaining !== undefined && (
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))] text-center">
                    {result.requestsRemaining} requests · {result.tokensRemaining?.toLocaleString()} tokens remaining
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
