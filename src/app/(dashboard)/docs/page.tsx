import { BookOpen, Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export default function DocsPage() {
  const curlExample = `curl ${BASE_URL}/api/v1/chat/completions \\
  -H "Authorization: Bearer tmp_xxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gemini-2.0-flash",
    "messages": [
      {
        "role": "user",
        "content": "Explain recursion in simple terms."
      }
    ]
  }'`;

  const pythonExample = `import requests

API_KEY = "tmp_xxxxxxxxx"
BASE_URL = "${BASE_URL}"

response = requests.post(
    f"{BASE_URL}/api/v1/chat/completions",
    headers={
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    },
    json={
        "model": "gemini-2.0-flash",
        "messages": [
            {"role": "user", "content": "Explain recursion in simple terms."}
        ],
        "temperature": 0.7,
        "maxTokens": 512,
    },
)

data = response.json()
print(data["choices"][0]["message"]["content"])
print(f"Tokens used: {data['usage']['total_tokens']}")
print(f"Requests remaining: {data['sandbox']['requests_remaining']}")`;

  const jsExample = `const API_KEY = "tmp_xxxxxxxxx";
const BASE_URL = "${BASE_URL}";

const response = await fetch(\`\${BASE_URL}/api/v1/chat/completions\`, {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "gemini-2.0-flash",
    messages: [
      { role: "user", content: "Explain recursion in simple terms." }
    ],
    temperature: 0.7,
    maxTokens: 512,
  }),
});

const data = await response.json();
console.log(data.choices[0].message.content);
console.log(\`Requests remaining: \${data.sandbox.requests_remaining}\`);`;

  const responseExample = `{
  "id": "gemini_1234567890",
  "object": "chat.completion",
  "model": "gemini-2.0-flash",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Recursion is when a function calls itself..."
      },
      "finish_reason": "STOP"
    }
  ],
  "usage": {
    "prompt_tokens": 12,
    "completion_tokens": 87,
    "total_tokens": 99
  },
  "sandbox": {
    "request_id": "req_a1b2c3d4",
    "provider": "gemini",
    "latency_ms": 842,
    "requests_remaining": 24,
    "tokens_remaining": 19901,
    "quota_expires_at": "2024-01-01T13:00:00.000Z"
  }
}`;

  const errorExample = `{
  "error": {
    "type": "rate_limit_exceeded",
    "message": "Key rate limit exceeded. Maximum 10 requests per minute.",
    "request_id": "req_x9y8z7",
    "retry_after": 60
  }
}`;

  return (
    <div className="animate-fade-in space-y-6 max-w-4xl">
      <div className="flex items-center gap-2">
        <BookOpen className="w-6 h-6 text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">API Documentation</h1>
          <p className="text-[hsl(var(--muted-foreground))] text-sm mt-1">
            Use your temporary key exactly like a real AI API key.
          </p>
        </div>
      </div>

      {/* Endpoint */}
      <Card className="border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <CardHeader><CardTitle className="text-sm text-white">Chat Completions Endpoint</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-[hsl(var(--muted))] rounded-lg">
            <span className="text-green-400 font-mono font-bold text-sm">POST</span>
            <code className="text-blue-400 text-sm">{BASE_URL}/api/v1/chat/completions</code>
          </div>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Compatible with OpenAI Chat Completions format. Authenticate with your <code className="text-green-400">tmp_xxx</code> key.
          </p>
        </CardContent>
      </Card>

      {/* Code examples */}
      <Card className="border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <CardHeader><CardTitle className="text-sm text-white">Code Examples</CardTitle></CardHeader>
        <CardContent>
          <Tabs defaultValue="curl">
            <TabsList className="bg-[hsl(var(--muted))] border-[hsl(var(--border))] mb-4">
              {["curl", "python", "javascript"].map((lang) => (
                <TabsTrigger key={lang} value={lang} className="text-xs capitalize data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  {lang}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="curl">
              <pre className="bg-[hsl(var(--muted))] rounded-lg p-4 text-xs text-green-300 overflow-x-auto">{curlExample}</pre>
            </TabsContent>
            <TabsContent value="python">
              <pre className="bg-[hsl(var(--muted))] rounded-lg p-4 text-xs text-green-300 overflow-x-auto">{pythonExample}</pre>
            </TabsContent>
            <TabsContent value="javascript">
              <pre className="bg-[hsl(var(--muted))] rounded-lg p-4 text-xs text-green-300 overflow-x-auto">{jsExample}</pre>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Response format */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <CardHeader><CardTitle className="text-sm text-white">✅ Success Response</CardTitle></CardHeader>
          <CardContent>
            <pre className="bg-[hsl(var(--muted))] rounded-lg p-4 text-xs text-green-300 overflow-x-auto">{responseExample}</pre>
          </CardContent>
        </Card>
        <Card className="border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <CardHeader><CardTitle className="text-sm text-white">❌ Error Response</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <pre className="bg-[hsl(var(--muted))] rounded-lg p-4 text-xs text-red-300 overflow-x-auto">{errorExample}</pre>
            <div className="space-y-2">
              {[
                { type: "authentication_failed", code: 401, desc: "Invalid or expired key" },
                { type: "rate_limit_exceeded", code: 429, desc: "Too many requests" },
                { type: "quota_exceeded", code: 429, desc: "Request or token quota exhausted" },
                { type: "key_expired", code: 401, desc: "Key lifetime exceeded" },
                { type: "provider_unavailable", code: 503, desc: "Provider down or not configured" },
                { type: "timeout", code: 504, desc: "Upstream request timed out" },
              ].map(({ type, code, desc }) => (
                <div key={type} className="flex items-center justify-between text-xs">
                  <code className="text-red-400">{type}</code>
                  <span className="text-[hsl(var(--muted-foreground))]">{code} · {desc}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Supported models */}
      <Card className="border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <CardHeader><CardTitle className="text-sm text-white">Supported Models</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { provider: "Google Gemini", models: ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash", "gemini-1.5-pro"] },
              { provider: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"] },
              { provider: "Mock (Demo)", models: ["mock-fast", "mock-standard", "mock-slow"] },
            ].map(({ provider, models }) => (
              <div key={provider}>
                <p className="text-xs font-semibold text-white mb-2">{provider}</p>
                <ul className="space-y-1">
                  {models.map((m) => (
                    <li key={m} className="text-xs font-mono text-[hsl(var(--muted-foreground))] flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
