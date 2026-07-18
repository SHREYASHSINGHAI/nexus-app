// ============================================================
// NEXUS — js/state.js
// Frontend Global State & Constants
// ============================================================

// ── STATE VARIABLES ──────────────────────────────────────────
let messages = [];
let isThinking = false;
const SESSION_ID = crypto.randomUUID();
let isFirstMessage = true;
let firstTaskDescription = '';
let lastRecommendationData = null; // cached for PDF generation/sharing

// ── AI TOOL DATABASE ──────────────────────────────────────────
const AI_TOOLS_DB = {
  writing: [
    { name:"Claude (Anthropic)", icon:"🤖", color:"#7c5cfc", tagline:"Advanced reasoning, long-form writing, and nuanced analysis", pricing:"Free / $20/mo Pro", type:"LLM", url:"https://claude.ai", description:"Best for complex writing tasks, document analysis, creative projects, and tasks requiring deep reasoning.", tradeoff:"Context window is generous but free tier has message limits; not ideal for high-volume automated writing.", guide:[{title:"Start a new chat",desc:"Go to <strong>claude.ai</strong> and click New Chat"},{title:"Describe your goal",desc:"Be specific about your task — tone, audience, format, length"},{title:"Iterate",desc:"Ask Claude to refine, expand, or change style as needed"},{title:"Use Projects",desc:"Organize related work using Claude's <strong>Projects</strong> feature"}]},
    { name:"ChatGPT (OpenAI)", icon:"💬", color:"#10a37f", tagline:"Versatile assistant with plugins and image generation", pricing:"Free / $20/mo Plus", type:"LLM", url:"https://chat.openai.com", description:"Excellent general-purpose writing assistant with web browsing, DALL-E image generation, and a vast plugin ecosystem.", tradeoff:"Can be verbose; free tier uses older GPT-3.5 which is noticeably weaker.", guide:[{title:"Sign up or log in",desc:"Visit <strong>chat.openai.com</strong>"},{title:"Pick a model",desc:"Use GPT-4o for best results"},{title:"Use Custom GPTs",desc:"Explore the GPT Store"},{title:"Enable browsing",desc:"Ask it to search the web for current facts"}]},
    { name:"Jasper AI", icon:"✍️", color:"#ff6b35", tagline:"Marketing-focused AI writing for teams", pricing:"From $39/mo", type:"Writing Agent", url:"https://jasper.ai", description:"Purpose-built for marketing teams. Brand voice training, campaign workflows, SEO optimization, and 50+ templates.", tradeoff:"Expensive for solo users; underlying models are third-party LLMs.", guide:[{title:"Set Brand Voice",desc:"Upload your brand guidelines"},{title:"Choose a Template",desc:"Browse 50+ templates"},{title:"Use Campaigns",desc:"Create multi-channel content from a single brief"},{title:"Integrate Surfer",desc:"Connect Surfer SEO for keyword-optimized content"}]},
    { name:"Notion AI", icon:"📝", color:"#555", tagline:"Embedded writing intelligence inside your workspace", pricing:"$8/mo add-on", type:"Workspace AI", url:"https://notion.so", description:"Seamlessly integrated into Notion for drafting, summarizing, and transforming notes.", tradeoff:"Only useful if you already use Notion; AI quality lags behind dedicated writing tools.", guide:[{title:"Enable Notion AI",desc:"Add the AI add-on in <strong>Settings → Plans</strong>"},{title:"Use Space Bar",desc:"Press Space in any page"},{title:"Summarize pages",desc:"Highlight text and ask AI to summarize"},{title:"Auto-fill databases",desc:"Let AI generate database properties"}]}
  ],
  coding: [
    { name:"GitHub Copilot", icon:"⚡", color:"#6e40c9", tagline:"Real-time code completion inside your IDE", pricing:"Free (limited) / $10/mo", type:"Code AI", url:"https://github.com/features/copilot", description:"The industry standard for AI code completion. Integrates into VS Code, JetBrains IDEs, Neovim, and more.", tradeoff:"Completions can be confidently wrong; works at file level only.", guide:[{title:"Install Extension",desc:"Search 'GitHub Copilot' in VS Code"},{title:"Authenticate",desc:"Sign in with your <strong>GitHub account</strong>"},{title:"Write Comments",desc:"Type a natural language comment and Copilot suggests code"},{title:"Tab to Accept",desc:"Press <strong>Tab</strong> to accept"}]},
    { name:"Cursor", icon:"🖱️", color:"#2563eb", tagline:"AI-native code editor with full codebase context", pricing:"Free / $20/mo Pro", type:"AI IDE", url:"https://cursor.sh", description:"A fork of VS Code with AI deeply embedded. Can understand and edit across your entire codebase.", tradeoff:"Requires local setup; free tier is limited.", guide:[{title:"Download Cursor",desc:"Install from <strong>cursor.sh</strong>"},{title:"Use Cmd+K",desc:"Highlight code and press Cmd+K to edit with AI"},{title:"Chat with Codebase",desc:"Press Cmd+L for full repo context"},{title:"Composer Mode",desc:"Use Composer for multi-file edits"}]},
    { name:"Replit AI", icon:"🔁", color:"#f76c2f", tagline:"Build and deploy full apps from the browser", pricing:"Free / $20/mo Core", type:"Cloud IDE", url:"https://replit.com", description:"Best for quick prototyping and deployment without local setup.", tradeoff:"Performance-limited for large projects; not suitable for proprietary codebases.", guide:[{title:"Create a Repl",desc:"Go to <strong>replit.com</strong>, click Create"},{title:"Ask Ghostwriter",desc:"Press Ctrl+I to open Ghostwriter"},{title:"Describe the app",desc:"Type what you want to build"},{title:"Deploy instantly",desc:"Click Deploy for a shareable URL"}]},
    { name:"Codeium", icon:"🟢", color:"#09b6a2", tagline:"Free AI code completion for every developer", pricing:"Free / $12/mo Teams", type:"Code AI", url:"https://codeium.com", description:"The best truly free Copilot alternative. Works in 70+ languages and 40+ editors.", tradeoff:"Slightly less accurate than Copilot on complex completions.", guide:[{title:"Install extension",desc:"Search 'Codeium' in your editor"},{title:"Create free account",desc:"Sign up at <strong>codeium.com</strong>"},{title:"Start coding",desc:"Completions appear automatically"},{title:"Use chat",desc:"Open Codeium Chat sidebar"}]}
  ],
  image: [
    { name:"Midjourney", icon:"🎨", color:"#2563eb", tagline:"World-class aesthetic image generation", pricing:"From $10/mo", type:"Image AI", url:"https://midjourney.com", description:"The gold standard for artistic image generation. Exceptional for concept art, illustrations, and aesthetic photography.", tradeoff:"No free tier; requires Discord; not ideal for text-heavy images.", guide:[{title:"Join Discord",desc:"Go to <strong>midjourney.com</strong> and click Join the Beta"},{title:"Use /imagine",desc:"Type /imagine followed by your prompt"},{title:"Add parameters",desc:"Append --ar 16:9 for widescreen"},{title:"Upscale & vary",desc:"Click U1-U4 to upscale"}]},
    { name:"DALL-E 3 (OpenAI)", icon:"🖼️", color:"#10a37f", tagline:"Text-accurate image generation integrated with ChatGPT", pricing:"Included in ChatGPT Plus", type:"Image AI", url:"https://chat.openai.com", description:"Best for images requiring accurate text rendering and precise prompt following.", tradeoff:"Artistic style is generic compared to Midjourney; limited resolution.", guide:[{title:"Open ChatGPT",desc:"Visit <strong>chat.openai.com</strong> with Plus"},{title:"Describe your image",desc:"Type 'Generate an image of...'"},{title:"Iterate with chat",desc:"Ask ChatGPT to modify naturally"},{title:"Right-click to save",desc:"Download in full resolution"}]},
    { name:"Stable Diffusion (Auto1111)", icon:"⚙️", color:"#8b5cf6", tagline:"Open-source powerhouse with unlimited customization", pricing:"Free (self-hosted)", type:"Open Source", url:"https://github.com/AUTOMATIC1111/stable-diffusion-webui", description:"Runs locally, completely free, with thousands of community models and fine-tuning support.", tradeoff:"Requires a capable GPU and technical setup; steep learning curve.", guide:[{title:"Install Python",desc:"Ensure Python 3.10+ is installed"},{title:"Clone the repo",desc:"Run: git clone the AUTOMATIC1111 repo"},{title:"Run webui.sh",desc:"Execute <strong>./webui.sh</strong> and open localhost:7860"},{title:"Download models",desc:"Get models from Civitai.com"}]},
    { name:"Adobe Firefly", icon:"🔥", color:"#ff4444", tagline:"Commercially safe AI images inside Adobe tools", pricing:"Included in Adobe CC / Free tier", type:"Creative AI", url:"https://firefly.adobe.com", description:"Trained on licensed content, making it commercially safe. Integrates with Photoshop and Illustrator.", tradeoff:"Output quality and creative range lags behind Midjourney.", guide:[{title:"Visit firefly.adobe.com",desc:"Create a free Adobe account"},{title:"Generate images",desc:"Use the <strong>Text to Image</strong> feature"},{title:"Generative Fill",desc:"In Photoshop, select an area and press Generate Fill"},{title:"Style matching",desc:"Upload a reference image to match its style"}]}
  ],
  research: [
    { name:"Perplexity AI", icon:"🔍", color:"#2563eb", tagline:"Real-time AI search with cited sources", pricing:"Free / $20/mo Pro", type:"Search AI", url:"https://perplexity.ai", description:"The best AI for research requiring current information. Searches the web in real-time with full citations.", tradeoff:"Can still hallucinate when sources are thin.", guide:[{title:"Go to perplexity.ai",desc:"No account needed for basic use"},{title:"Ask your question",desc:"Type any research question"},{title:"Check sources",desc:"Click the numbered citations to verify"},{title:"Use Focus modes",desc:"Select Academic, YouTube, or Reddit"}]},
    { name:"Elicit", icon:"📚", color:"#6b7280", tagline:"AI research assistant for academic literature", pricing:"Free (limited) / $10/mo", type:"Research AI", url:"https://elicit.com", description:"Purpose-built for academic research. Automatically finds relevant papers, extracts key data, and synthesizes findings.", tradeoff:"Limited to academic papers; not useful for web research.", guide:[{title:"Create an account",desc:"Sign up at <strong>elicit.com</strong>"},{title:"Ask a research question",desc:"Enter your hypothesis or topic"},{title:"Review papers",desc:"Elicit finds relevant papers"},{title:"Build your table",desc:"Add columns for data points"}]},
    { name:"NotebookLM (Google)", icon:"📓", color:"#4285f4", tagline:"AI that reasons over YOUR documents", pricing:"Free", type:"Document AI", url:"https://notebooklm.google", description:"Upload your own PDFs, documents, and notes. NotebookLM becomes an expert on YOUR sources only.", tradeoff:"Only knows what you upload — cannot answer questions beyond your provided sources.", guide:[{title:"Go to notebooklm.google",desc:"Sign in with a Google account"},{title:"Upload sources",desc:"Add PDFs, Google Docs, YouTube links"},{title:"Ask questions",desc:"Chat with your documents"},{title:"Generate summaries",desc:"Use the Study Guide feature"}]}
  ],
  voice: [
    { name:"ElevenLabs", icon:"🎙️", color:"#f59e0b", tagline:"Ultra-realistic AI voice cloning and generation", pricing:"Free / From $5/mo", type:"Voice AI", url:"https://elevenlabs.io", description:"Industry-leading voice AI for realistic text-to-speech, voice cloning, and multilingual voiceovers.", tradeoff:"Free tier is limited to 10,000 characters/month.", guide:[{title:"Sign up",desc:"Create account at <strong>elevenlabs.io</strong>"},{title:"Pick a voice",desc:"Browse the Voice Library or design your own"},{title:"Paste your text",desc:"Enter your script in the Speech Synthesis editor"},{title:"Adjust settings",desc:"Tune Stability and Clarity sliders"}]},
    { name:"Suno AI", icon:"🎵", color:"#8b5cf6", tagline:"Generate full songs with vocals from text prompts", pricing:"Free / From $8/mo", type:"Music AI", url:"https://suno.com", description:"Create complete songs with lyrics, melody, and vocals from a simple text description.", tradeoff:"Limited control over exact musical structure; commercial licensing terms contested.", guide:[{title:"Go to suno.com",desc:"Sign in with Google or Discord"},{title:"Describe your song",desc:"Enter a song style description"},{title:"Write lyrics (optional)",desc:"Enable Custom Mode"},{title:"Download & share",desc:"Download the MP3"}]}
  ],
  video: [
    { name:"Runway ML", icon:"🎬", color:"#ec4899", tagline:"Professional AI video generation and editing", pricing:"Free (125 credits) / From $15/mo", type:"Video AI", url:"https://runwayml.com", description:"The professional choice for AI video. Gen-3 text-to-video, image-to-video, and video-to-video transformation.", tradeoff:"Expensive per-credit; free tier is very limited; videos max at 10-16 seconds.", guide:[{title:"Sign up at runwayml.com",desc:"Create account and get 125 free credits"},{title:"Choose Gen-3",desc:"Select the Gen-3 Alpha model"},{title:"Write your prompt",desc:"Describe camera movement and mood"},{title:"Extend clips",desc:"Use Video to Video to extend footage"}]},
    { name:"Sora (OpenAI)", icon:"☀️", color:"#f59e0b", tagline:"Cinematic-quality video from text descriptions", pricing:"Included in ChatGPT Plus/Pro", type:"Video AI", url:"https://sora.com", description:"OpenAI's flagship video model producing strikingly realistic video up to 20 seconds.", tradeoff:"Requires ChatGPT Plus/Pro; limited to 20 seconds; restrictive content policy.", guide:[{title:"Access via ChatGPT",desc:"Visit <strong>sora.com</strong> with Plus"},{title:"Write a detailed prompt",desc:"Include lighting, camera angle, environment"},{title:"Set duration",desc:"Choose 5-20 second clips"},{title:"Remix & storyboard",desc:"Use the Storyboard feature"}]},
    { name:"HeyGen", icon:"🧑‍💼", color:"#2563eb", tagline:"AI avatar video creation for business", pricing:"Free (1 min) / From $24/mo", type:"Avatar AI", url:"https://heygen.com", description:"Create professional-grade videos with AI avatars. Perfect for corporate training and multilingual content.", tradeoff:"Free tier gives only 1 minute; avatar videos can appear uncanny.", guide:[{title:"Sign up at heygen.com",desc:"Create account — free tier includes 1 minute"},{title:"Pick an avatar",desc:"Choose from 100+ realistic AI avatars"},{title:"Write your script",desc:"Type or paste your script"},{title:"Translate & localize",desc:"Dub into 40+ languages with lip-sync"}]}
  ],
  automation: [
    { name:"Make (Integromat)", icon:"🔗", color:"#6d28d9", tagline:"Visual workflow automation with 1500+ app integrations", pricing:"Free / From $9/mo", type:"Automation", url:"https://make.com", description:"Visual drag-and-drop automation builder connecting 1500+ apps. More powerful than Zapier for complex workflows.", tradeoff:"Steeper learning curve; pricing can escalate with high operation volumes.", guide:[{title:"Create account at make.com",desc:"Free plan includes 1,000 operations/month"},{title:"Create a Scenario",desc:"Click Create a Scenario and search for your trigger"},{title:"Add modules",desc:"Connect apps by clicking the + button"},{title:"Test & schedule",desc:"Run once to test, then set a schedule"}]},
    { name:"n8n", icon:"🔄", color:"#ea4b71", tagline:"Open-source automation with AI node support", pricing:"Free (self-hosted) / From $20/mo cloud", type:"Open Source Automation", url:"https://n8n.io", description:"Developer-friendly automation platform with native AI agent capabilities. Self-hostable for maximum control.", tradeoff:"Requires server setup for self-hosting; less intuitive UI for non-developers.", guide:[{title:"Install n8n",desc:"Run: npx n8n or use Docker"},{title:"Build your workflow",desc:"Drag nodes from the left panel"},{title:"Add AI nodes",desc:"Use OpenAI, Claude, or Ollama nodes"},{title:"Activate",desc:"Toggle the Active switch"}]},
    { name:"Zapier", icon:"⚡", color:"#ff4a00", tagline:"The easiest app-to-app automation for non-developers", pricing:"Free (5 Zaps) / From $19.99/mo", type:"Automation", url:"https://zapier.com", description:"The most user-friendly automation tool. Best for simple trigger-action workflows.", tradeoff:"Expensive for multi-step or high-volume workflows.", guide:[{title:"Go to zapier.com",desc:"Sign up — free plan includes 5 Zaps"},{title:"Click Make a Zap",desc:"Or describe your workflow in natural language"},{title:"Set trigger",desc:"Choose the app and event"},{title:"Add action",desc:"Pick what happens next, test it, and turn it on"}]}
  ],
  data: [
    { name:"Julius AI", icon:"📊", color:"#10b981", tagline:"Conversational data analysis and visualization", pricing:"Free / From $20/mo", type:"Data AI", url:"https://julius.ai", description:"Upload CSVs, Excel files, or databases and analyze them through conversation. Creates charts without writing code.", tradeoff:"Less powerful than writing actual Python; not suited for real-time data.", guide:[{title:"Go to julius.ai",desc:"Sign in and click New Analysis"},{title:"Upload your data",desc:"Drag and drop a CSV, Excel, or connect Google Sheets"},{title:"Ask questions",desc:"Type questions in natural language"},{title:"Generate charts",desc:"Ask for visualizations"}]},
    { name:"ChatGPT Advanced Data Analysis", icon:"🐍", color:"#10a37f", tagline:"Code-executing data analysis inside ChatGPT", pricing:"Included in ChatGPT Plus", type:"Data AI", url:"https://chat.openai.com", description:"Upload files and let GPT-4 write and execute Python to analyze and visualize your data.", tradeoff:"Session-based — code and files don't persist after the chat ends.", guide:[{title:"Use ChatGPT Plus",desc:"Ensure you have a Plus subscription"},{title:"Attach your file",desc:"Click the paperclip icon to upload"},{title:"Ask for analysis",desc:"Summarize this data and show trends"},{title:"Download outputs",desc:"Right-click charts or request code downloads"}]}
  ]
};

// ── SYSTEM PROMPT ─────────────────────────────────────────────
const SYSTEM_PROMPT = `You are NEXUS, a strictly neutral AI Tool Intelligence System. You match users with best-fit AI tools and generate precise, optimised prompts for each tool based on the user's exact task and context.

════════════════════════════════════════
CRITICAL SAFETY GUARDRAILS — HIGHEST PRIORITY
════════════════════════════════════════

MEDICAL & HEALTH REQUESTS:
- ONLY trigger this guardrail if the user is asking for medical advice, diagnosis, treatment, or medication recommendations FOR THEMSELVES OR OTHERS.
- Do NOT trigger this guardrail if the user wants to BUILD, DEVELOP, or CREATE a software application, tool, or system that happens to involve medical or health data — that is a legitimate technical task.
- Examples that should NOT trigger: "build a medicine tracker app", "create a calorie counter", "develop a hospital management system", "make a fitness tracking app", "build a pill reminder" — these are all coding/product tasks.
- Examples that SHOULD trigger: "what medicine should I take for fever", "is paracetamol safe for me", "what are symptoms of diabetes", "suggest treatment for my back pain" — these are requests for personal medical advice.
- If the user asks for medical advice, diagnosis, treatment, or medication recommendations — STOP immediately.
- Do NOT recommend any medicine, drug, supplement, or treatment to any person.
- Respond ONLY with:
"• NEXUS is an AI tool recommender, not a medical professional.
• Please consult a qualified doctor for any health-related concerns.
• Never take medication or begin treatment without proper medical advice.
• 🚑 Ambulance: 108 | 🚔 Police: 100 | 🚒 Fire Brigade: 101 | 🆘 Emergency: 112"
- After this message, ask if they have a different non-medical task.

════════════════════════════════════════
ABSOLUTE NEUTRALITY RULES
════════════════════════════════════════
- ZERO preference for any tool, company, or brand
- Free/open-source tools recommended over paid if they fit better
- Scores reflect pure requirement-fit only
- Equal fits → rank by lowest price first

════════════════════════════════════════
TOOL RECOMMENDATION RULES
════════════════════════════════════════
- You are NOT limited to any hardcoded list of tools
- When live search data is provided above, USE IT — prioritise those tools
- Recommend the best tool regardless of how obscure or new it is
- Always include the tool's real URL when you know it

════════════════════════════════════════
PERSONALITY & FORMAT
════════════════════════════════════════
Precise, analytical, neutral. Always respond in SHORT BULLET POINTS only during conversation.
- Every conversational response MUST use bullet points starting with •
- Max 1 short sentence per bullet, max 6 bullets per response
- Never write paragraphs during conversation turns

════════════════════════════════════════
SMART CONVERSATION FLOW
════════════════════════════════════════
CRITICAL — Read the user's FIRST message carefully BEFORE asking any questions:
- Extract budget if already stated (e.g. "free", "no cost", "without paying" → budget = "Free only")
- Extract skill level if already stated (e.g. "I'm a beginner", "no coding experience" → skill = "Beginner")
- Extract domain from the task description
- Only ask questions for information NOT already provided
- NEVER repeat or confirm what the user just told you — move straight to the next question

TURN 1 (user describes task):
• Acknowledge the task in 1 SHORT bullet — no repeating what they said
• If task spans MULTIPLE domains: "• This task requires a multi-tool pipeline across [N] subtasks."
• IF budget already known → skip budget question entirely, go to skill level or Turn 3
• IF budget NOT mentioned → ask ONLY: "What is your budget?"
• Output OPTIONS block ONLY if asking a question

TURN 2 (after budget answered):
• Do NOT say "Got it", "Noted", "Thanks", or repeat their budget back to them
• IF skill level already known → skip, go to Turn 3
• IF skill level NOT mentioned → ask ONLY: "What is your technical skill level?"
• Output OPTIONS block only if asking the question

TURN 3 (after skill level answered):
• Do NOT repeat or confirm their skill level
• Ask ONE specific clarifying question about the USE CASE — NOT about tool preference
• Good examples: "What is your primary output format?", "Do you need it to work offline?", "Is this for a one-time task or ongoing use?"
• BAD examples — NEVER ask: "Which tool do you prefer?", "Do you have a tool in mind?" — NEXUS decides the tool
• Output OPTIONS block with 3-4 relevant choices

TURN 4 (summary + confirmation — ONE TIME ONLY):
• Show a single clean summary of EVERYTHING you understood. Format it as:
"• Here is what I understood:
  — Task: [one line]
  — Budget: [value]
  — Skill level: [value]
  — Use case detail: [one line]"
• Then ask ONE question: "• Is there anything else you'd like to add before I generate recommendations?"
• Output this OPTIONS block:
|||OPTIONS_START
["No, generate recommendations", "Yes, I want to add something"]
|||OPTIONS_END

TURN 5a — If user says NO or "generate recommendations":
• Immediately output the final JSON recommendation block. Do not write any other text.

TURN 5b — If user says YES or adds something:
• Acknowledge in 1 bullet: "• Got it — including that in the recommendations."
• Immediately output the final JSON recommendation block. Do not write any other text.

FINAL RECOMMENDATIONS FORMAT:
When generating recommendations, you MUST output ONLY a JSON block.
CRITICAL INSTRUCTION — THIS IS MANDATORY:
- You MUST output ONLY a JSON block starting with |||JSON_START and ending with |||JSON_END
- Do NOT write any text before |||JSON_START
- Do NOT write any text after |||JSON_END
- Do NOT write "Here's how you can proceed" or any prose
- Do NOT write bullet points outside the JSON
- The ENTIRE response must be ONLY the JSON block — nothing else
- If you write anything other than the JSON block, you have failed this task
- Choose FORMAT A for single-domain tasks, FORMAT B for multi-domain pipeline tasks

Output EXACTLY ONE of these two formats with no other text:

─── FORMAT A: SINGLE-TOOL TASK ───
|||JSON_START
{
  "mode": "single",
  "domain": "[domain name]",
  "reasoning": "[1 sentence why these fits user requirements]",
  "tools": ["[Tool Name 1]", "[Tool Name 2]", "[Tool Name 3]"],
  "scores": [[fit score 1-100], [fit score 2-100], [fit score 3-100]],
  "tool_prompts": [
    {
      "tool": "[Tool Name 1]",
      "prompts": [
        {
          "label": "[e.g. Master Outline Prompt]",
          "purpose": "[briefly what this prompt outputs]",
          "prompt": "[A detailed, production-grade custom prompt instructing the LLM on structure, style, and content relevant to the user's specific task. Use markdown place-holders like [insert your details] where needed.]"
        }
      ]
    }
  ],
  "action_steps": [
    {
      "step": 1,
      "tool": "[Tool Name 1]",
      "action": "[precise instruction on what to do first, e.g. Paste prompt 1 into Tool 1]",
      "duration": "[expected time, e.g. 5-10 min]"
    }
  ]
}
|||JSON_END

─── FORMAT B: PIPELINE (MULTI-TOOL) TASK ───
|||JSON_START
{
  "mode": "pipeline",
  "summary": "[1 sentence overview of the integrated workflow]",
  "reasoning": "[1 sentence why these tools were selected for this pipeline]",
  "pipeline": [
    {
      "step": 1,
      "subtask": "[subtask name, e.g. Voiceover Generation]",
      "tool": "[Best tool name for step 1]",
      "fit_score": [fit score 1-100],
      "description": "[1 sentence what this tool does in this step]",
      "output": "[data/file generated, e.g. MP3 Voice Track]",
      "connects_to": [next step number or null if final],
      "prompts": [
        {
          "label": "[e.g. Script Voice Over Prompt]",
          "purpose": "[briefly what this prompt outputs]",
          "prompt": "[A detailed, custom system-style prompt instructing the voice generator on tone, script structures, and details relevant to user's specific task.]"
        }
      ]
    }
  ],
  "orchestration": "[1 sentence instructions on how to pass outputs between the tools, e.g. Export MP3 from ElevenLabs, import it into Runway Gen-3 along with your images]",
  "action_steps": [
    {
      "step": 1,
      "tool": "[Tool Name for Step 1]",
      "action": "[precise action, e.g. Generate voice track using script prompt]",
      "duration": "[e.g. 5 min]"
    }
  ]
}
|||JSON_END
`;
