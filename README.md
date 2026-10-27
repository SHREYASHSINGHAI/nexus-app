<div align="center">

# ◈ NEXUS

### AI Tool Intelligence System

**Find the perfect AI tool for any task — in under 2 minutes.**

NEXUS asks you a few smart questions, searches the web live for the latest AI tools,
and delivers ranked recommendations with ready-to-use prompts and a step-by-step execution plan.
</div>

---

## What Makes NEXUS Different

Most AI tool directories give you a static list to scroll through. NEXUS is different — it holds a conversation, understands your specific situation, and then recommends the single best tool (or set of tools) for *your* task, *your* budget, and *your* skill level.

- **Not a chatbot** — every response moves you closer to a recommendation
- **Not a sponsored directory** — zero brand deals, scores based purely on fit
- **Not limited to a preset list** — searches the web live on every recommendation
- **Not just a name** — gives you working prompts you can paste straight into the tool

---

## How It Works

```
You describe your task
        ↓
NEXUS extracts budget + skill level from your message (skips asking if already stated)
        ↓
1–3 focused follow-up questions
        ↓
Live search of theresanaiforthat.com via Tavily API
        ↓
Dynamic Model Resolution (Auto-discovers active Groq models & ranks tools)
        ↓
Recommendations with scores, tradeoffs, prompts, and a step-by-step execution roadmap
```

---

## Features

### Intelligence & Resilience

| Feature | Description |
|---------|-------------|
| Smart extraction | Reads budget and skill from your first message — never asks twice |
| Dynamic Model Discovery | Auto-discovers active models for your Groq API key with 5-min in-memory caching |
| Automatic Model Fallback | Seamlessly routes requests to high-performance available models (`llama-3.3-70b-versatile`, `openai/gpt-oss-120b`, `openai/gpt-oss-20b`) |
| Rate-Limit Resilience | Handles HTTP 429 spikes with automatic exponential backoff retry loops |
| Single tool mode | Top 3 tools ranked by fit score with detailed reasoning |
| Pipeline mode | Detects multi-domain tasks and builds a connected workflow across multiple tools |
| Live search | Searches theresanaiforthat.com on the final turn via Tavily API |
| Fit score rings | Circular SVG rings — green ≥80%, amber 60–79%, red <60% |
| Honest tradeoffs | Real downsides shown for every tool, not just positives |
| Neutrality | Free tools rank above paid when they fit better |

### Prompts & Guidance

| Feature | Description |
|---------|-------------|
| Ready-to-use prompts | Primary and Refinement prompts per tool — copy and paste, no editing needed |
| Execution Roadmap | Numbered action steps with prompts embedded inline at each step |
| Quick Start Guides | Collapsible 4-step setup guide inside every tool card |

### Account, Access & Subscriptions

| Feature | Description |
|---------|-------------|
| Session History | Logged-in users can browse all past sessions and reopen any recommendation |
| PDF Export | Download a clean formatted PDF of any recommendation |
| Share Link | Generate a short unique URL to share any recommendation with teammates |
| Session Limit & Quota | Free users get 3 full workflows per week; paid tiers up to 1000/week |
| Subscriptions & Payments | Multi-currency Razorpay checkout with localized INR and USD pricing |
| Mandatory Auth | Google OAuth exclusively via Supabase |

### Safety & Error Handling

| Feature | Description |
|---------|-------------|
| Categorized Error UI | Translates raw API errors into clean, actionable status cards (Auth, Model, Limit, Quota) |
| Medical guardrail | Blocks personal medical advice requests; shows Indian emergency numbers |
| Smart detection | "Build a medicine tracker app" is correctly treated as a coding task, not a medical query |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vanilla HTML + CSS + JS — single `index.html`, no build step |
| AI Engine | Dynamic Model Resolution & Fallback via [Groq](https://groq.com) LPU (`llama-3.3-70b-versatile`, `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, etc.) |
| Live Search | [Tavily API](https://tavily.com) → theresanaiforthat.com |
| Auth & DB | [Supabase](https://supabase.com) — Auth, User Sessions & Subscription Quotas |
| Payments | [Razorpay](https://razorpay.com) — Multi-currency subscriptions |
| Hosting | [Vercel](https://vercel.com) — Serverless Functions & Edge Routing |
| Fonts | Syne · JetBrains Mono · Instrument Serif |

---

## File Structure

```
nexus-app/
├── index.html            ← Entire frontend — HTML, CSS, and JS in one file
├── api/
│   ├── chat.js           ← Dynamic model resolution + Groq proxy + Tavily live search + quota enforcement
│   ├── models.js         ← Diagnostic endpoint to list active Groq models for your key
│   ├── config.js         ← Serves Supabase public config and Razorpay keys
│   ├── share.js          ← Creates and retrieves shared recommendation URLs
│   ├── create-order.js   ← Multi-currency Razorpay order creation
│   └── verify-payment.js ← Secure Razorpay payload verification and DB updates
├── vercel.json           ← API routing and serverless function configuration
└── package.json          ← Dependencies including Razorpay SDK
```

> **Why `config.js`?** The Supabase anon key must reach the browser to initialise Auth, but hardcoding it in `index.html` exposes it in source. `config.js` reads it from Vercel environment variables at request time — credentials stay in Vercel, out of the codebase entirely.

---

## Environment Variables

Configure these in **Vercel → Project → Settings → Environment Variables**.
Never commit these in any public code file.

| Variable | Required | Description / How to get it |
|----------|:--------:|------------------------------|
| `GROQ_API_KEY` | **Yes** | [console.groq.com](https://console.groq.com) → API Keys |
| `TAVILY_API_KEY` | **Yes** | [app.tavily.com](https://app.tavily.com) → Dashboard |
| `SUPABASE_URL` | **Yes** | Supabase Project Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | **Yes** | Supabase Project Settings → API Keys → `anon` public key |
| `RAZORPAY_KEY_ID` | Optional | Razorpay Dashboard → Settings → API Keys |
| `RAZORPAY_KEY_SECRET` | Optional | Razorpay Dashboard → Settings → API Keys |
| `GROQ_MODEL` | Optional | Force a specific Groq model (e.g. `llama-3.3-70b-versatile`, `openai/gpt-oss-120b`). Defaults to automatic auto-detection. |

---

## Getting Started

### Prerequisites

- A [Vercel](https://vercel.com) account (free)
- A [Groq](https://console.groq.com) account (free)
- A [Tavily](https://app.tavily.com) account (free)
- A [Supabase](https://supabase.com) account (free)

### Deploy in 5 minutes

**1. Fork the repo**

Click **Fork** on GitHub, or clone it:
```bash
git clone https://github.com/SHREYASHSINGHAI/nexus-app.git
cd nexus-app
```

**2. Connect to Vercel**

Go to [vercel.com/new](https://vercel.com/new) → import your fork → Deploy.
Vercel reads `vercel.json` and configures everything automatically.

**3. Add environment variables**

Vercel → your project → Settings → Environment Variables → add all 4 keys → **Redeploy**.

**4. Set up Supabase Auth**

- Create a project at [supabase.com](https://supabase.com)
- Authentication → Providers → Google → Enable → add your Google OAuth Client ID and Secret
- Authentication → URL Configuration → set Site URL and Redirect URL to your Vercel deployment URL

**5. Configure Google OAuth**

At [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials:
```
Authorized redirect URI:      https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback
Authorized JavaScript origins: https://your-app.vercel.app
```

**6. Deploy**

Every future change deploys automatically:
```bash
git add .
git commit -m "your change"
git push
```

---

## Local Development

```bash
# Install Vercel CLI
npm i -g vercel

# Pull environment variables from your Vercel project
vercel env pull .env.local

# Start local dev server (API routes + frontend together)
npx vercel dev

# Opens at http://localhost:3000
```

---

## API Reference

### `POST /api/chat`

Main conversation endpoint. Performs dynamic model resolution on Groq, runs live web search via Tavily on turn 2+, and enforces subscription quotas.

<details>
<summary>Request body (from <code>index.html</code>)</summary>

```json
{
  "model": "llama-3.3-70b-versatile",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "max_tokens": 1200,
  "temperature": 0.7,
  "top_p": 0.9,
  "sessionId": "b8f047bb-a982-4ad5-9dfc-c76b92a34346",
  "taskDescription": "Build a personal portfolio website",
  "meta": {
    "isFirstMessage": true,
    "domain": null,
    "budget": null,
    "skillLevel": null,
    "userId": "user-uuid-or-null",
    "userEmail": "user@example.com",
    "anonId": "anon-session-id",
    "fingerprint": "visitor-id"
  }
}
```
</details>

**Response:** Standard OpenAI-compatible chat completion object from Groq, or categorized error JSON (`groq_auth`, `groq_model`, `context_length`, `rate_limit`, `session_limit`).

---

### `GET /api/models`

Live diagnostic endpoint. Authenticates with your `GROQ_API_KEY` and returns the real-time list of available models for your specific Groq key.

```json
{
  "status": "success",
  "totalModels": 28,
  "chatModels": [
    "llama-3.3-70b-versatile",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3.8-27b",
    "llama-3.1-8b-instant"
  ],
  "allModels": [...]
}
```

---

### `GET /api/config`

Called on frontend initialization. Serves public Supabase and Razorpay credentials without hardcoding secrets in client HTML.

```json
{
  "supabaseUrl": "https://your-project.supabase.co",
  "supabaseAnon": "your-publishable-key",
  "razorpayKey": "rzp_live_or_test_key"
}
```

---

### `POST /api/create-order`

Initializes a Razorpay subscription order. Detects user country via Vercel edge headers (`x-vercel-ip-country`) to automatically switch between INR and USD pricing.

```json
// Request
{ "plan_id": "basic" } // "basic" | "pro" | "max"

// Response (India)
{ "id": "order_EKfLwp8P5Q40st", "currency": "INR", "amount": 4900 }

// Response (International)
{ "id": "order_EKfLwp8P5Q40st", "currency": "USD", "amount": 99 }
```

---

### `POST /api/verify-payment`

Verifies the cryptographic HMAC SHA-256 signature from Razorpay and updates the user's subscription record in Supabase.

```json
// Request
{
  "razorpay_order_id": "order_EKfLwp8P5Q40st",
  "razorpay_payment_id": "pay_29QQoUBi66xm2f",
  "razorpay_signature": "9ef5743127cd0f8e974d4be44f51e00b20667d52800098ec1cac85c8acc47d05",
  "plan_id": "basic",
  "user_id": "uuid"
}

// Response
{ "success": true }
```

---

### `POST /api/share`

Generates a unique 8-character share ID for a recommendation session.

```json
// Request
{ "sessionId": "b8f047bb-a982-4ad5-9dfc-c76b92a34346" }

// Response
{ "shareId": "a1b2c3d4" }
```

The full share URL is constructed in the browser: `https://your-app.vercel.app/r/a1b2c3d4`

---

### `GET /api/share?id=a1b2c3d4`

Retrieves a shared recommendation. No login required to view a shared link.

```json
{
  "session": { "recommended_tools": ["..."], "share_id": "a1b2c3d4" },
  "messages": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

---

## Subscription Plans & Limits

Quotas and pricing implemented in `api/create-order.js`, `api/verify-payment.js`, and `index.html`:

| Plan ID | Plan Name | Workflows Quota | Price (India) | Price (International) | Reset Interval |
|:---:|:---:|:---:|:---:|:---:|:---:|
| **`free`** | Free Tier | **3 workflows** / week | Free | Free | Rolling 7 days |
| **`basic`** | Basic Tier | **35 workflows** / week | **₹49** / month | **$0.99** / month | Rolling 7 days |
| **`pro`** | Pro Tier | **70 workflows** / week | **₹99** / month | **$1.99** / month | Rolling 7 days |
| **`max`** | Agency Tier | **1,000 workflows** / week | **₹399** / month | **$5.00** / month | Rolling 7 days |

---

## Built-in Tool Database

**25 curated tools across 8 domains** hardcoded in `AI_TOOLS_DB` within `index.html`. Known tools render as full cards with step-by-step guides, honest tradeoffs, and copyable prompts. Tools discovered live via Tavily API render as supplementary tool cards with a direct link.

| Domain | Count | Tools Included |
|:---|:---:|:---|
| **Writing** | 4 | Claude (Anthropic) · ChatGPT (OpenAI) · Jasper AI · Notion AI |
| **Coding** | 4 | GitHub Copilot · Cursor · Replit AI · Codeium |
| **Image** | 4 | Midjourney · DALL-E 3 (OpenAI) · Stable Diffusion (Auto1111) · Adobe Firefly |
| **Research** | 3 | Perplexity AI · Elicit · NotebookLM (Google) |
| **Voice** | 2 | ElevenLabs · Suno AI |
| **Video** | 3 | Runway ML · Sora (OpenAI) · HeyGen |
| **Automation** | 3 | Make (Integromat) · n8n · Zapier |
| **Data** | 2 | Julius AI · ChatGPT Advanced Data Analysis |

---

## Service Tier Limits

| Service | Allowance | Frequency / Resets |
|---------|-----------|--------------------|
| **Groq API** | Rate limits vary by active model (RPM / TPM / RPD) | Check [console.groq.com/settings/limits](https://console.groq.com/settings/limits) |
| **Tavily API** | 1,000 searches / month | Monthly billing cycle |
| **Supabase** | 500 MB database · 50,000 monthly active users | Monthly |
| **Vercel** | 100 GB edge bandwidth · Serverless execution limits | Monthly |

> At 4 Groq calls + 1 Tavily search per session, the free tiers comfortably support **~200 full sessions per day**.

---

## Roadmap & Recent Optimizations

- [x] Streaming responses — real-time Server-Sent Events (SSE) token streaming for conversational turns (<300ms TTFT)
- [x] Native Structured JSON mode — deterministic schema output via Groq JSON mode, eliminating regex parsing and retry latency
- [x] Speculative search pre-fetching — pre-warms live Tavily tool search context during conversation turns
- [x] Semantic query distillation — intent and stop-word filtering to extract high-signal search keywords
- [x] Hybrid tool catalog — expanded database with modern tools (Lovable, v0, Bolt.new, Windsurf, Flux.1, Kling, Gamma) and alias matching
- [ ] Tool comparison table — side-by-side view of recommended tools
- [ ] Feedback buttons — 👍 / 👎 on each recommendation card
- [ ] Referral system — share links that earn bonus sessions

---

## License

[MIT](LICENSE) — free to use, modify, and deploy.

---

## Acknowledgements

| | |
|-|-|
| [Groq](https://groq.com) | Fastest LLM inference API |
| [Tavily](https://tavily.com) | AI-optimised web search |
| [There's An AI For That](https://theresanaiforthat.com) | Most comprehensive AI tool directory |
| [Supabase](https://supabase.com) | Open source auth and database |
| [Razorpay](https://razorpay.com) | Multi-currency subscriptions |
| [Vercel](https://vercel.com) | Zero-config deployment |

---

<div align="center">
  <br/>
  Built by <strong>Shreyash Singhai</strong>
  <br/><br/>
  <a href="https://nexus-app-delta.vercel.app">nexus-app-delta.vercel.app</a>
</div>
