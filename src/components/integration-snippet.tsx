"use client";

import { useState } from "react";
import { Copy, Check, FileCode, Code2, Terminal, Sparkles, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

interface IntegrationSnippetProps {
  apiKey?: string;
  model?: string;
  className?: string;
}

export function IntegrationSnippet({
  apiKey = "tmp_your_key_here",
  model = "gemini-3.5-flash",
  className = "",
}: IntegrationSnippetProps) {
  const [tab, setTab] = useState<"env" | "node" | "python" | "curl">("env");
  const [copied, setCopied] = useState(false);

  const baseUrl = typeof window !== "undefined" ? `${window.location.origin}/api/v1` : "http://localhost:3005/api/v1";

  const snippets = {
    env: `# Paste directly into your project's .env file:
SANDBOX_BASE_URL="${baseUrl}"
SANDBOX_API_KEY="${apiKey}"
AI_MODEL="${model}"

# Standard OpenAI-compatible format (works with OpenAI SDK & LangChain):
OPENAI_BASE_URL="${baseUrl}"
OPENAI_API_KEY="${apiKey}"`,

    node: `import OpenAI from "openai";

// Initialize OpenAI client pointing to AI Sandbox Gateway
const openai = new OpenAI({
  baseURL: "${baseUrl}",
  apiKey: "${apiKey}",
});

const response = await openai.chat.completions.create({
  model: "${model}",
  messages: [{ role: "user", content: "Hello AI!" }],
});

console.log(response.choices[0].message.content);`,

    python: `from openai import OpenAI

client = OpenAI(
    base_url="${baseUrl}",
    api_key="${apiKey}"
)

response = client.chat.completions.create(
    model="${model}",
    messages=[{"role": "user", "content": "Hello AI!"}]
)

print(response.choices[0].message.content)`,

    curl: `curl ${baseUrl}/chat/completions \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${model}",
    "messages": [{"role": "user", "content": "Hello AI!"}]
  }'`,
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(snippets[tab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied to clipboard!" });
  };

  return (
    <Card className={`border-blue-500/30 bg-gradient-to-r from-blue-950/30 via-[hsl(var(--card))] to-indigo-950/20 shadow-xl overflow-hidden ${className}`}>
      <CardHeader className="pb-3 border-b border-border/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base text-white">Direct .env & Code Syntax</CardTitle>
              <CardDescription className="text-xs">
                Copy and paste this into any software to start using the sandbox AI gateway instantly.
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-black/50 p-1 rounded-lg border border-border/60 self-start sm:self-auto">
            <button
              onClick={() => setTab("env")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                tab === "env" ? "bg-blue-600 text-white shadow-sm" : "text-muted-foreground hover:text-white"
              }`}
            >
              <FileCode className="w-3.5 h-3.5" /> .env
            </button>
            <button
              onClick={() => setTab("node")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                tab === "node" ? "bg-blue-600 text-white shadow-sm" : "text-muted-foreground hover:text-white"
              }`}
            >
              <Code2 className="w-3.5 h-3.5" /> Node / JS
            </button>
            <button
              onClick={() => setTab("python")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                tab === "python" ? "bg-blue-600 text-white shadow-sm" : "text-muted-foreground hover:text-white"
              }`}
            >
              <Code2 className="w-3.5 h-3.5" /> Python
            </button>
            <button
              onClick={() => setTab("curl")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                tab === "curl" ? "bg-blue-600 text-white shadow-sm" : "text-muted-foreground hover:text-white"
              }`}
            >
              <Terminal className="w-3.5 h-3.5" /> cURL
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 pb-4">
        <div className="relative group">
          <pre className="p-4 rounded-xl bg-black/70 border border-border/70 text-xs font-mono text-emerald-400 overflow-x-auto leading-relaxed">
            {snippets[tab]}
          </pre>
          <Button
            size="sm"
            onClick={handleCopy}
            className="absolute top-3 right-3 bg-blue-600/90 hover:bg-blue-600 text-white text-xs gap-1.5 shadow-md"
          >
            {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied!" : "Copy Snippet"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
