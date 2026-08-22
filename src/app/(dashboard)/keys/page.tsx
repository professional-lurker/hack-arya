"use client";

import { useState, useEffect } from "react";
import { Key, Plus, Copy, Check, Trash2, ToggleLeft, ToggleRight, Clock, Terminal, Code2, FileCode, CheckCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

interface Provider { id: string; name: string; displayName: string }
interface SandboxKey {
  id: string; name?: string | null; keyPrefix: string; status: string;
  maxRequests: number; requestsUsed: number; maxTokens: number; tokensUsed: number;
  maxRatePer60s: number; expiresAt: string; createdAt: string;
  provider: { name: string; displayName: string };
  simulationFlags?: Record<string, boolean>;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  ACTIVE:   { label: "Active",    className: "text-green-400 border-green-400/30 bg-green-400/10" },
  CREATED:  { label: "Active",    className: "text-green-400 border-green-400/30 bg-green-400/10" },
  EXPIRED:  { label: "Expired",   className: "text-red-400 border-red-400/30 bg-red-400/10" },
  EXHAUSTED:{ label: "Exhausted", className: "text-orange-400 border-orange-400/30 bg-orange-400/10" },
  REVOKED:  { label: "Revoked",   className: "text-gray-400 border-gray-400/30 bg-gray-400/10" },
};

const SIM_FLAGS = [
  { key: "rate_limit", label: "Simulate Rate Limit" },
  { key: "quota_exhausted", label: "Simulate Quota Exhausted" },
  { key: "timeout", label: "Simulate Timeout" },
  { key: "provider_unavailable", label: "Simulate Provider Down" },
  { key: "auth_failed", label: "Simulate Auth Failure" },
];

const selectClass = "w-full bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none";
const inputClass  = "w-full bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500";
const labelClass  = "block text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1";

export default function KeysPage() {
  const [keys, setKeys] = useState<SandboxKey[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newKeySecret, setNewKeySecret] = useState<string | null>(null);
  const [newKeyProvider, setNewKeyProvider] = useState<string>("gemini");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [snippetTab, setSnippetTab] = useState<"env" | "node" | "python" | "curl">("env");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "", providerId: "", maxRequests: "25", maxTokens: "20000",
    maxRatePer60s: "10", lifetimeSeconds: "3600",
  });

  const baseUrl = typeof window !== "undefined" ? `${window.location.origin}/api/v1` : "http://localhost:3005/api/v1";

  const fetchKeys = async () => {
    const res = await fetch("/api/v1/keys");
    if (res.ok) { const d = await res.json(); setKeys(d.keys); }
    setLoading(false);
  };

  useEffect(() => {
    const loadInitialData = async () => {
      await fetchKeys();
      const response = await fetch("/api/v1/providers");
      const data = await response.json();
      setProviders(data.providers ?? []);
      if (data.providers?.length) {
        setForm((current) => ({ ...current, providerId: data.providers[0].id }));
      }
    };

    const timeoutId = window.setTimeout(() => void loadInitialData(), 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const handleCreate = async () => {
    if (!form.providerId) { toast({ title: "Select a provider", variant: "destructive" }); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/v1/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name || undefined,
          providerId: form.providerId,
          maxRequests: parseInt(form.maxRequests),
          maxTokens: parseInt(form.maxTokens),
          maxRatePer60s: parseInt(form.maxRatePer60s),
          lifetimeSeconds: parseInt(form.lifetimeSeconds),
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: data.error ?? "Failed to create key", variant: "destructive" }); return; }
      setNewKeySecret(data.key.secretKey);
      const selectedProv = providers.find(p => p.id === form.providerId)?.name ?? "gemini";
      setNewKeyProvider(selectedProv);
      await fetchKeys();
      toast({ title: "Key created successfully!" });
    } finally { setCreating(false); }
  };

  const handleCopy = async (text: string, id: string = "default") => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
    toast({ title: "Copied to clipboard!" });
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Revoke this key? It will immediately stop working.")) return;
    await fetch(`/api/v1/keys/${id}`, { method: "DELETE" });
    await fetchKeys();
    toast({ title: "Key revoked" });
  };

  const handleSimFlag = async (keyId: string, flag: string, value: boolean, currentFlags: Record<string, boolean>) => {
    await fetch(`/api/v1/keys/${keyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ simulationFlags: { ...currentFlags, [flag]: value } }),
    });
    await fetchKeys();
    toast({ title: value ? `Simulation ON: ${flag}` : `Simulation OFF: ${flag}` });
  };

  const activeKeyForSnippet = keys.find(k => k.status === "ACTIVE" || k.status === "CREATED");
  const sampleKeyStr = newKeySecret || (activeKeyForSnippet ? `${activeKeyForSnippet.keyPrefix}...` : "tmp_your_sandbox_key_here");
  const activeModel = newKeyProvider === "gemini" ? "gemini-3.5-flash" : "mock-fast";

  const getSnippets = (key: string, model: string = "gemini-3.5-flash") => ({
    env: `# Paste directly into your project's .env file:
SANDBOX_BASE_URL="${baseUrl}"
SANDBOX_API_KEY="${key}"
AI_MODEL="${model}"

# Standard OpenAI-compatible format (works with OpenAI SDK & LangChain):
OPENAI_BASE_URL="${baseUrl}"
OPENAI_API_KEY="${key}"`,

    node: `import OpenAI from "openai";

// Initialize OpenAI client directed to Sandbox Gateway
const openai = new OpenAI({
  baseURL: "${baseUrl}",
  apiKey: "${key}",
});

const response = await openai.chat.completions.create({
  model: "${model}",
  messages: [{ role: "user", content: "Hello AI!" }],
});

console.log(response.choices[0].message.content);`,

    python: `from openai import OpenAI

client = OpenAI(
    base_url="${baseUrl}",
    api_key="${key}"
)

response = client.chat.completions.create(
    model="${model}",
    messages=[{"role": "user", "content": "Hello AI!"}]
)

print(response.choices[0].message.content)`,

    curl: `curl ${baseUrl}/chat/completions \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${model}",
    "messages": [{"role": "user", "content": "Hello AI!"}]
  }'`
  });

  const currentSnippets = getSnippets(sampleKeyStr, activeModel);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">API Keys & Quick Paste</h1>
          <p className="text-[hsl(var(--muted-foreground))] mt-1 text-sm">Generate temporary credentials and copy direct .env syntax for any software.</p>
        </div>
        <Button onClick={() => { setShowModal(true); setNewKeySecret(null); }} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-lg shadow-blue-500/20">
          <Plus className="w-4 h-4" /> Generate Key
        </Button>
      </div>

      {/* Quick Paste Prompt Card */}
      <Card className="border-blue-500/30 bg-gradient-to-r from-blue-950/30 via-[hsl(var(--card))] to-indigo-950/20 shadow-xl overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base text-white">Direct .env & Code Snippet</CardTitle>
                <CardDescription className="text-xs">Paste this directly into your app&apos;s <code className="text-blue-300">.env</code> to connect any software to this AI sandbox.</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-border/50">
              <button
                onClick={() => setSnippetTab("env")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${snippetTab === "env" ? "bg-blue-600 text-white" : "text-muted-foreground hover:text-white"}`}
              >
                <FileCode className="w-3.5 h-3.5" /> .env
              </button>
              <button
                onClick={() => setSnippetTab("node")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${snippetTab === "node" ? "bg-blue-600 text-white" : "text-muted-foreground hover:text-white"}`}
              >
                <Code2 className="w-3.5 h-3.5" /> Node / TS
              </button>
              <button
                onClick={() => setSnippetTab("python")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${snippetTab === "python" ? "bg-blue-600 text-white" : "text-muted-foreground hover:text-white"}`}
              >
                <Code2 className="w-3.5 h-3.5" /> Python
              </button>
              <button
                onClick={() => setSnippetTab("curl")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${snippetTab === "curl" ? "bg-blue-600 text-white" : "text-muted-foreground hover:text-white"}`}
              >
                <Terminal className="w-3.5 h-3.5" /> cURL
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 pb-4">
          <div className="relative group">
            <pre className="p-4 rounded-lg bg-black/60 border border-border/60 text-xs font-mono text-emerald-400 overflow-x-auto leading-relaxed">
              {currentSnippets[snippetTab]}
            </pre>
            <Button
              size="sm"
              onClick={() => handleCopy(currentSnippets[snippetTab], "snippet-card")}
              className="absolute top-3 right-3 bg-blue-600/90 hover:bg-blue-600 text-white text-xs gap-1.5 shadow-md"
            >
              {copiedKey === "snippet-card" ? <CheckCheck className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedKey === "snippet-card" ? "Copied!" : "Copy Snippet"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modal with Direct .env Syntax Output */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl w-full max-w-xl p-6 space-y-4 shadow-2xl animate-scale-in">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Key className="w-5 h-5 text-blue-400" />
              {newKeySecret ? "Key Generated — Copy Your .env Syntax" : "Generate Temporary API Key"}
            </h2>

            {newKeySecret ? (
              <div className="space-y-4">
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <p className="text-xs text-amber-300 font-medium">⚠️ Save this key now — it will never be displayed in plaintext again.</p>
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Direct .env Syntax (Copy & Paste directly into your project&apos;s .env)</label>
                  <div className="relative">
                    <pre className="p-3.5 bg-black/70 border border-emerald-500/30 rounded-xl text-xs font-mono text-emerald-400 overflow-x-auto whitespace-pre leading-relaxed">
                      {getSnippets(newKeySecret, activeModel).env}
                    </pre>
                    <Button
                      size="sm"
                      onClick={() => handleCopy(getSnippets(newKeySecret, activeModel).env, "modal-env")}
                      className="absolute top-2.5 right-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
                    >
                      {copiedKey === "modal-env" ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedKey === "modal-env" ? "Copied!" : "Copy .env"}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Raw Secret Key</label>
                  <div className="p-3 bg-black/50 border border-border rounded-lg text-xs font-mono text-blue-300 break-all select-all flex items-center justify-between">
                    <span>{newKeySecret}</span>
                    <button onClick={() => handleCopy(newKeySecret, "modal-raw")} className="text-muted-foreground hover:text-white p-1 ml-2">
                      {copiedKey === "modal-raw" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button onClick={() => handleCopy(newKeySecret, "modal-btn-copy")} variant="outline" className="flex-1 gap-2 border-[hsl(var(--border))]">
                    {copiedKey === "modal-btn-copy" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    {copiedKey === "modal-btn-copy" ? "Copied Raw Key" : "Copy Raw Key"}
                  </Button>
                  <Button onClick={() => { setShowModal(false); setNewKeySecret(null); }} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label className={labelClass}>Key Name (optional)</label>
                  <input className={inputClass} placeholder="e.g. ChatInter Test Key" value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>Provider *</label>
                  <select className={selectClass} value={form.providerId}
                    onChange={e => setForm({ ...form, providerId: e.target.value })}>
                    {providers.map(p => <option key={p.id} value={p.id}>{p.displayName} {p.name === "gemini" ? "(Gemini 3.5 Flash Active)" : ""}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Max Requests</label>
                    <select className={selectClass} value={form.maxRequests}
                      onChange={e => setForm({ ...form, maxRequests: e.target.value })}>
                      {["5","10","25","50","100","500"].map(v => <option key={v} value={v}>{v} requests</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Lifetime</label>
                    <select className={selectClass} value={form.lifetimeSeconds}
                      onChange={e => setForm({ ...form, lifetimeSeconds: e.target.value })}>
                      <option value="600">10 minutes</option>
                      <option value="1800">30 minutes</option>
                      <option value="3600">1 hour</option>
                      <option value="21600">6 hours</option>
                      <option value="86400">24 hours</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Token Limit</label>
                  <input type="number" className={inputClass} value={form.maxTokens}
                    onChange={e => setForm({ ...form, maxTokens: e.target.value })} />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1 border-[hsl(var(--border))]" onClick={() => setShowModal(false)}>Cancel</Button>
                  <Button onClick={handleCreate} disabled={creating} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                    {creating ? "Generating..." : "Generate Key & Get Syntax"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Keys list */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
      ) : keys.length === 0 ? (
        <Card className="border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <CardContent className="py-16 text-center">
            <Key className="w-10 h-10 text-[hsl(var(--muted-foreground))] mx-auto mb-3" />
            <p className="text-white font-medium">No API keys yet</p>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Generate your first temporary key to get instant .env syntax.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {keys.map(key => {
            const statusCfg = STATUS_BADGE[key.status] ?? STATUS_BADGE.ACTIVE;
            const reqPct = (key.requestsUsed / key.maxRequests) * 100;
            const tokPct = (key.tokensUsed / key.maxTokens) * 100;
            const barClass = (p: number) => p > 80 ? "danger" : p > 60 ? "warning" : "safe";
            const isActive = key.status === "ACTIVE" || key.status === "CREATED";
            const simFlags = key.simulationFlags ?? {};
            const hasActiveSim = Object.values(simFlags).some(Boolean);

            return (
              <Card key={key.id} className="border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-white">{key.name ?? "Unnamed Key"}</p>
                        <Badge variant="outline" className={`text-[10px] ${statusCfg.className}`}>{statusCfg.label}</Badge>
                        {hasActiveSim && <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-400/30 bg-amber-400/10">SIM ACTIVE</Badge>}
                      </div>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] font-mono">{key.keyPrefix}...</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 flex items-center gap-2">
                        <span>{key.provider.displayName}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />
                          {isActive ? `expires ${formatDistanceToNow(new Date(key.expiresAt), { addSuffix: true })}` : format(new Date(key.expiresAt), "MMM d, h:mm a")}
                        </span>
                      </p>
                    </div>
                    {isActive && (
                      <button onClick={() => handleRevoke(key.id)} className="text-red-400 hover:text-red-300 p-1.5 rounded hover:bg-red-400/10 transition-colors" title="Revoke">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {[
                      { label: "Requests", used: key.requestsUsed, max: key.maxRequests, pct: reqPct },
                      { label: "Tokens", used: Math.round(key.tokensUsed/1000*10)/10, max: Math.round(key.maxTokens/1000), suffix: "K", pct: tokPct },
                    ].map(({ label, used, max, suffix = "", pct }) => (
                      <div key={label}>
                        <div className="flex justify-between text-xs text-[hsl(var(--muted-foreground))] mb-1">
                          <span>{label}</span>
                          <span className="font-mono">{used}{suffix} / {max}{suffix}</span>
                        </div>
                        <div className="quota-bar"><div className={`quota-fill ${barClass(pct)}`} style={{ width: `${Math.min(100, pct)}%` }} /></div>
                      </div>
                    ))}
                  </div>

                  {isActive && (
                    <div className="border-t border-[hsl(var(--border))] pt-3 mt-3">
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2">Failure Simulation Testing</p>
                      <div className="flex flex-wrap gap-2">
                        {SIM_FLAGS.map(({ key: flag, label }) => {
                          const on = Boolean(simFlags[flag]);
                          return (
                            <button
                              key={flag}
                              onClick={() => handleSimFlag(key.id, flag, !on, simFlags)}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border transition-all ${
                                on
                                  ? "bg-amber-500/20 border-amber-500/50 text-amber-300 font-medium"
                                  : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--muted-foreground))]"
                              }`}
                            >
                              {on ? <ToggleRight className="w-3.5 h-3.5 text-amber-400" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
