# AI Sandbox 🚀

> **Build your AI application first. Test the integration safely. Commit to a provider later.**

A production-quality platform for developers and hackathon participants to generate temporary, quota-limited AI API credentials for safely testing integrations — without exposing real provider keys or accumulating unexpected bills.

---

## ✨ Key Features

- **🔑 Temporary API Keys** — Generate `tmp_xxx` credentials with customizable request caps, token budgets, and automatic expiration.
- **🛡️ Reverse Proxy Gateway** — OpenAI-compatible (`/api/v1/chat/completions`) gateway that routes calls to Gemini, OpenWeather, OpenAI, or Mock models without exposing real secrets.
- **⚡ Direct `.env` Syntax** — 1-click copyable `.env` and SDK snippets (Node/TypeScript, Python, cURL) for instant integration into any codebase.
- **📊 Authoritative Quota Enforcement** — Server-side token and request counter validation with auto-exhaustion and auto-expiration.
- **🚦 Multi-Tier Rate Limiting** — Sliding-window rate limits per key, per user, and per IP with Redis and in-memory fallback.
- **💥 Failure Simulation Engine** — Test how your application handles rate limits (429), timeouts (504), provider downtime (503), or auth errors (401) on demand.
- **🌤️ Multi-Provider Support** — Google Gemini 3.7/3.6/3.5 Flash (with resilient 503 fallback), OpenWeather (live & forecast), and zero-cost Mock AI.
- **📈 Real-Time Analytics & Audit Trails** — Live telemetry of requests, token consumption, latency metrics, and security audit logs.
- **🧪 Interactive Playground** — Browser-based API tester with parameter controls (temperature, max tokens) and token metrics.

---

## 🏗️ Architecture

```text
                               ┌──────────────────────────────────────────────┐
                               │             Developer Clients                │
                               │   (ChatInter, Python SDK, LangChain, curl)   │
                               └──────────────────────┬───────────────────────┘
                                                      │ HTTP / Authorization: Bearer tmp_xxx
                                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                           AI SANDBOX PLATFORM                                                   │
│                                                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│   │                                       Next.js App Layer (:3005)                                         │   │
│   │                                                                                                         │   │
│   │   ┌───────────────────────────┐  ┌──────────────────────────────┐  ┌────────────────────────────────┐   │   │
│   │   │  Frontend Pages (React)   │  │    REST API Management       │  │       AI Gateway Pipeline      │   │   │
│   │   │  - /dashboard             │  │    - /api/v1/keys            │  │  POST /api/v1/chat/completions │   │   │
│   │   │  - /keys (Direct .env)    │  │    - /api/v1/providers       │  │  POST /api/chat (Alias)        │   │   │
│   │   │  - /playground            │  │    - /api/v1/health          │  │                                │   │   │
│   │   │  - /projects              │  │    - /api/v1/analytics       │  │  1. Key Prefix Lookup (O(1))   │   │   │
│   │   │  - /requests              │  │    - /api/v1/admin/*         │  │  2. Bcrypt Key Hash Verify     │   │   │
│   │   │                           │  │                              │  │  3. Sliding Window Rate Limit  │   │   │
│   │   │                           │  │  Session Auth:               │  │  4. Authoritative Quota Check  │   │   │
│   │   │                           │  │  NextAuth Cookie / JWT       │  │  5. Failure Simulator Hook     │   │   │
│   │   └───────────────────────────┘  └──────────────────────────────┘  └────────────────┬───────────────┘   │   │
│   └─────────────────────────────────────────────────────────────────────────────────────┼───────────────────┘   │
│                                                                                         │                       │
│                                            Provider Router                              │                       │
│                                 (Resolves provider from key entity)                     │                       │
│                                                         │                               │                       │
│                 ┌───────────────────────┬───────────────┴───────────────┬───────────────┴───────────────────┐   │
│                 ▼                       ▼                               ▼                                   ▼   │
│      ┌────────────────────┐  ┌────────────────────┐          ┌────────────────────┐              ┌─────────────┐│
│      │   Gemini Adapter   │  │ OpenWeather Adapter│          │   OpenAI Adapter   │              │Mock Adapter ││
│      │(REST + 3.7/3.6/3.5)│  │(Current & Forecast)│          │   (Official SDK)   │              │(Zero credits││
│      └──────────┬─────────┘  └──────────┬─────────┘          └──────────┬─────────┘              └──────┬──────┘│
│                 │                       │                               │                               │       │
└─────────────────┼───────────────────────┼───────────────────────────────┼───────────────────────────────┼───────┘
                  │                       │                               │                               │
                  ▼                       ▼                               ▼                               ▼
         ┌─────────────────┐     ┌─────────────────┐             ┌─────────────────┐                ┌───────────┐
         │Google Generative│     │   OpenWeather   │             │   OpenAI API    │                │ Local In- │
         │  Language API   │     │    REST API     │             │  api.openai.com │                │ Memory AI │
         └─────────────────┘     └─────────────────┘             └─────────────────┘                └───────────┘
```

---

## 🚀 Quick Start (Local Setup)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/Abhishek2344/ai-sandbox.git
cd ai-sandbox
npm install
```

### 2. Configure Environment Variables
Copy the example file to `.env.local`:
```bash
cp .env.example .env.local
```

Configure `.env.local`:
```env
DATABASE_URL="file:./prisma/dev.db"
NEXTAUTH_SECRET="dev-secret-key-change-in-production-32chars"
NEXTAUTH_URL="http://localhost:3005"
ENCRYPTION_KEY="0000000000000000000000000000000000000000000000000000000000000000"

# Optional Upstream Keys:
GEMINI_API_KEY="your-gemini-api-key"
OPENWEATHER_API_KEY="your-openweather-api-key"
OPENAI_API_KEY=""
```

### 3. Initialize Database & Demo Seed
```bash
npx prisma generate
npx prisma db push
npx prisma db seed
```

### 4. Start the Application
```bash
npm run dev
```
Open **[http://localhost:3005](http://localhost:3005)**

---

## 🔑 Demo Credentials

| Role | Email | Password |
| :--- | :--- | :--- |
| **Demo User** | `demo@aisandbox.dev` | `Demo@12345!` |
| **Admin** | `admin@aisandbox.dev` | `Admin@123!` |

---

## 📋 Direct Integration Example

In your client application's `.env`:
```env
OPENAI_BASE_URL="http://localhost:3005/api/v1"
OPENAI_API_KEY="tmp_your_generated_sandbox_key"
AI_MODEL="gemini-3.7-flash"
```

In your code (Node.js / Python / cURL):
```javascript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: process.env.OPENAI_BASE_URL,
  apiKey: process.env.OPENAI_API_KEY,
});

const response = await client.chat.completions.create({
  model: "gemini-3.7-flash",
  messages: [{ role: "user", content: "Hello AI Sandbox!" }],
});

console.log(response.choices[0].message.content);
```

---

## 🔐 Security Architecture

- **Zero Real Secret Leakage**: Master provider keys are stored encrypted via AES-256-GCM server-side and never delivered to the client or browser.
- **Prefix-Indexed Key Hashing**: Sandbox credentials (`tmp_...`) are hashed using `bcrypt` (cost factor 10) with indexed 14-character prefixes for O(1) candidate lookup without storing plaintext.
- **Authoritative Server Quotas**: Quota checks, rate limits, and failure simulations are executed strictly on the backend.
- **Parameterized SQL**: All database access is protected against SQL injection via Prisma ORM.

---

## 🛠 Tech Stack

- **Framework**: Next.js 16.3.2 (App Router, Turbopack)
- **Frontend**: React 19, Tailwind CSS, Lucide React, Date-fns
- **Database**: SQLite with `@prisma/adapter-better-sqlite3` and Prisma ORM v7
- **Authentication**: NextAuth.js v5 (beta) with JWT sessions
- **Validation & Crypto**: Zod, Bcryptjs, Node.js Native Crypto (AES-256-GCM)
- **AI Integrations**: Google Gemini REST API (3.7/3.6/3.5 Flash), OpenWeather REST API, OpenAI SDK, Mock Provider

---

## 📄 License
MIT License. Built for hackathons, developers, and secure AI exploration.
