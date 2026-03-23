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
Llama 3.3 70B ranks tools by requirement fit — no bias
        ↓
Recommendations with scores, tradeoffs, prompts, and a step-by-step execution roadmap
```

---

## Features

### Intelligence

| Feature | Description |
|---------|-------------|
| Smart extraction | Reads budget and skill from your first message — never asks twice |
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

### Account & Access

| Feature | Description |
|---------|-------------|
| Session History | Logged-in users can browse all past sessions and reopen any recommendation |
| PDF Export | Download a clean formatted PDF of any recommendation |
| Share Link | Generate a short unique URL to share any recommendation with teammates |
| Session limit | Anonymous users get 5 free searches per day; sign in for unlimited |
| Google OAuth + Email login | Via Supabase Auth |

### Safety

| Feature | Description |
|---------|-------------|
| Medical guardrail | Blocks personal medical advice requests; shows Indian emergency numbers |
| Smart detection | "Build a medicine tracker app" is correctly treated as a coding task, not a medical query |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vanilla HTML + CSS + JS — single `index.html`, no build step |
| AI Model | Llama 3.3 70B via [Groq](https://groq.com) |
| Live Search | [Tavily API](https://tavily.com) → theresanaiforthat.com |
| Auth | [Supabase Auth](https://supabase.com) — Google OAuth + Email/Password |
| Hosting | [Vercel](https://vercel.com) — auto-deploys on `git push` |
| Fonts | Syne · JetBrains Mono · Instrument Serif |

---

## File Structure

```
nexus-app/
├── index.html          ← Entire frontend — HTML, CSS, and JS in one file
├── api/
│   ├── chat.js         ← Groq proxy + Tavily live search on turn 4
│   ├── config.js       ← Serves Supabase public config from Vercel env vars
│   └── share.js        ← Creates and retrieves shared recommendation URLs
├── vercel.json         ← API routing configuration
└── package.json        ← Minimal — local dev script only
```

> **Why `config.js`?** The Supabase anon key must reach the browser to initialise Auth, but hardcoding it in `index.html` exposes it in source. `config.js` reads it from Vercel environment variables at request time — credentials stay in Vercel, out of the codebase entirely.

---

## Environment Variables

Set all four in **Vercel → Project → Settings → Environment Variables**.
Never put these in any code file.

| Variable | How to get it |
|----------|--------------|
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) → API Keys |
| `TAVILY_API_KEY` | [app.tavily.com](https://app.tavily.com) → Dashboard |
| `SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Supabase → Settings → API Keys → Publishable key |

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

Main conversation endpoint. Proxies to Groq. On turn 4 (when 3+ user messages exist), runs a Tavily search first and injects live results into the system prompt before calling Llama.

<details>
<summary>Request body</summary>

```json
{
  "model": "llama-3.3-70b-versatile",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "max_tokens": 8000,
  "temperature": 0.7,
  "top_p": 0.9
}
```
</details>

**Response:** Standard OpenAI-compatible chat completion object.

---

### `GET /api/config`

Called once on page load. Returns public Supabase credentials so the browser can initialise the Auth client — without those keys being hardcoded in HTML.

```json
{
  "supabaseUrl": "https://your-project.supabase.co",
  "supabaseAnon": "your-publishable-key"
}
```

---

### `POST /api/share`

Generates a unique 8-character share ID for a recommendation session.

```json
// Request
{ "sessionId": "uuid" }

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

## Built-in Tool Database

25 tools across 8 domains. Known tools render as full cards with guides, tradeoffs, and prompts. Tools discovered via live search render as fallback cards with a direct theresanaiforthat.com link.

| Domain | Tools included |
|--------|---------------|
| Writing | Claude · ChatGPT · Jasper AI · Notion AI |
| Coding | GitHub Copilot · Cursor · Replit AI · Codeium |
| Image | Midjourney · DALL-E 3 · Stable Diffusion · Adobe Firefly |
| Research | Perplexity AI · Elicit · NotebookLM |
| Voice | ElevenLabs · Suno AI |
| Video | Runway ML · Sora · HeyGen |
| Automation | Make · n8n · Zapier |
| Data | Julius AI · ChatGPT Advanced Data Analysis |

---

## Free Tier Limits

| Service | Free allowance | Resets |
|---------|---------------|--------|
| Groq | 30 req/min · 1,000 req/day · 500K tokens/day | Midnight PT |
| Tavily | 1,000 searches/month | Monthly |
| Supabase | 500MB storage · 50,000 monthly active users | Monthly |
| Vercel | 100GB bandwidth · unlimited deployments | Monthly |

> At 4 Groq calls + 1 Tavily search per session, the free tiers comfortably support **~200 full sessions per day**.

---

## Roadmap

- [ ] Streaming responses — show tokens as they arrive instead of waiting for the full reply
- [ ] Tool comparison table — side-by-side view of recommended tools
- [ ] Feedback buttons — 👍 / 👎 on each recommendation card
- [ ] Referral system — share links that earn bonus sessions
- [ ] Pro plan — remove session limits and priority support

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
| [Vercel](https://vercel.com) | Zero-config deployment |

---

<div align="center">
  <br/>
  Built by <strong>Shreyash Singhai</strong>
  <br/><br/>
  <a href="https://nexus-app-delta.vercel.app">nexus-app-delta.vercel.app</a>
</div>
