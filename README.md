# ◈ NEXUS

### AI Tool Intelligence System

NEXUS is an AI-powered task-first recommendation platform that helps users discover the most suitable AI tools for their exact work requirement instead of manually searching through hundreds of tools.

Rather than acting like a static directory, NEXUS asks focused questions, understands the task context, searches live tool information, and recommends the best-fit tools along with ready-to-use prompts and execution guidance.

---

## 🚀 Problem NEXUS Solves

The AI ecosystem is growing rapidly, but most users struggle with:

* too many tool choices
* unclear differences between tools
* difficulty selecting tools based on task
* lack of practical implementation guidance

NEXUS solves this by converting a user goal into a practical recommendation workflow.

---

## ✨ Current Features (Version 2)

### Intelligent Recommendation Engine

* Accepts natural language task input
* Understands requirement context before recommendation
* Asks focused follow-up questions only when needed

### AI Tool Ranking

* Recommends tools based on requirement fit
* Provides ranked output instead of generic lists
* Explains why each tool fits the task

### Prompt Assistance

* Generates ready-to-use prompts for recommended tools

### Execution Guidance

* Suggests how to use selected tools step by step

### Live Search Layer

* Uses live external search before recommendation generation

### Download Support

* Users can download recommendation output

### Google Authentication

* Google sign-in integration is active

### Web Application Interface

* Single-page interactive frontend

### Deployment Ready

* Configured for Vercel deployment

---

## 🧠 How NEXUS Works

User Task Input
↓
Requirement Understanding
↓
Focused Clarification
↓
Live Search
↓
AI Ranking Engine
↓
Tool Recommendation
↓
Prompt + Execution Guidance

---

## 🛠 Tech Stack

### Frontend

* HTML
* CSS
* JavaScript

### Backend

* Vercel Serverless Functions

### AI Layer

* Groq API

### Search Layer

* Tavily API

### Authentication

* Supabase Google Auth

### Deployment

* Vercel

---

## 📁 Project Structure

```bash
nexus-app/
│
├── index.html
│
├── api/
│   ├── chat.js
│
├── vercel.json
├── package.json
└── README.md
```

---

## ⚙️ Local Development

```bash
npm install
npm run dev
```

Runs locally using:

```bash
vercel dev
```

---

## 🌐 Deployment

Push repository to GitHub and connect directly with Vercel for deployment.

---

## 📌 Product Positioning

NEXUS is a task-first AI tool intelligence platform.

Instead of asking users to search for tools manually, it first understands what they want to achieve, then recommends the most relevant AI stack.

---

## ⚠ Current Scope

Currently removed / inactive in Version 2:

* session history
* shareable recommendation links
* anonymous usage limits

---

## 👤 Developer

Built by **Shreyash Singhai**

Focused on practical AI systems that solve real user decision problems.
