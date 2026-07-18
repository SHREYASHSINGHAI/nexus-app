# NEXUS — Library Refactoring & Optimization Suggestions

This document lists custom code blocks in the Nexus AI application that can be replaced or optimized using standard, lightweight libraries. Replacing these blocks will reduce boilerplate, improve safety, and enhance code readability.

---

## 1. Backend Orchestration (`api/chat.js`)

### Custom Retries & Rate-Limit Backoff
* **Current Implementation (Lines 75–116)**:
  Uses a custom `for` loop with dynamic sleeping (`setTimeout` wrapped in a Promise) to retry requests to the Groq API up to 3 times on `429` (Rate Limit) status codes.
* **Library Replacement**: Official `@groq/groq-sdk` or standard `openai` SDK.
* **Refactoring Benefit**:
  - Automatically handles authorization headers, request/response JSON serialization, and status-based retries (including backoff).
  - Eliminates manual HTTP status checking (`429`, `500`) and the custom `waitMs` sleeping block.
  - **Lines of code saved**: ~40 lines.

#### Before vs After:
```javascript
// BEFORE (Custom fetch + retry loop)
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', { ... });
    if (groqRes.status === 429) { /* Sleep and retry */ }
  } catch (err) { ... }
}

// AFTER (Using @groq/groq-sdk)
import Groq from 'groq-sdk';
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const chatCompletion = await groq.chat.completions.create({
  messages: enrichedMessages,
  model: model || 'llama-3.3-70b-versatile',
  max_tokens: max_tokens || 8000,
});
```

---

## 2. Backend Database Connector (`api/lib/supabase.js`)

### Raw Database REST Fetch Requests
* **Current Implementation (Lines 118–142)**:
  Uses custom `dbInsert` and `dbPatch` fetch wrappers that construct REST headers (such as `apikey`, `Authorization`, `Prefer`) and append query string filters (`?id=eq.${id}`) manually.
* **Library Replacement**: `@supabase/supabase-js`.
* **Refactoring Benefit**:
  - Replaces raw URL queries with standard ORM-style queries (`supabase.from(table).insert()`, `supabase.from(table).update()`).
  - Standardizes the database layer between the frontend and backend (both now use the same syntax).
  - Reduces URL concatenation bugs.
  - **Lines of code saved**: ~25 lines.

#### Before vs After:
```javascript
// BEFORE (Custom fetch wrapper)
async function dbPatch(url, headers, table, id, data) {
  const res = await fetch(`${url}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(data)
  });
}

// AFTER (Using Supabase Client)
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

await supabase.from('sessions').update(data).eq('id', id);
```

---

## 3. Frontend Markdown Parsing (`js/ui.js` / `js/rendering.js`)

### Custom Regex Bullet Formatter
* **Current Implementation (`formatBullets` in `js/ui.js`)**:
  Splits content text by newlines and applies custom string replacement loops to convert lines starting with `•` or `-` into HTML list elements.
* **Library Replacement**: `marked` (lightweight markdown parser).
* **Refactoring Benefit**:
  - Handles complete Markdown syntax (bold, links, nested bullets, tables, paragraphs) instead of only basic list lines.
  - Promotes cleaner separation of text formatting and HTML construction.
  - **Lines of code saved**: ~10 lines (plus supports comprehensive rich text).

#### Before vs After:
```javascript
// BEFORE (Custom bullet logic)
function formatBullets(text) {
  return text.split('\n').map(line => {
    if (line.trim().startsWith('•')) return `<li>${line.replace(/^[•]\s*/, '')}</li>`;
    return line;
  }).join('');
}

// AFTER (Using marked)
import { marked } from 'marked';
const htmlDisplay = marked.parse(rawText);
```

---

## 4. Frontend PDF Export (`js/rendering.js`)

### Custom Printing Layout Formatter
* **Current Implementation (`exportPDF` in `js/rendering.js`)**:
  Uses a custom print layout injector that overrides styles on `window.print()` to print only the results panel contents and then restores the original window configuration.
* **Library Replacement**: `html2pdf.js` or `jspdf`.
* **Refactoring Benefit**:
  - Renders the results panel straight into a high-fidelity PDF without launching the system browser print print dialogue.
  - Gives pixel-perfect control over PDF sizes, margins, and layouts.
  - **Lines of code saved**: ~30 lines.

---

## 5. UI Icons & Visual Assets (`index.html`)

### Inline SVG Elements
* **Current Implementation**:
  Large inline SVGs (like the Google OAuth logo and general controls icons) are placed directly inside the HTML structure.
* **Library Replacement**: Lucide Icons or FontAwesome.
* **Refactoring Benefit**:
  - Cleans up index.html structure significantly.
  - Enhances layout readability.
  - **Lines of code saved**: ~50 lines of raw SVG vectors.

#### Before vs After:
```html
<!-- BEFORE -->
<button class="google-btn">
  <svg viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12..." fill="#4285F4"/>...</svg>
  Continue with Google
</button>

<!-- AFTER -->
<button class="google-btn">
  <i class="lucide-google"></i>
  Continue with Google
</button>
```

---

## Summary of Code Reduction Potential

| Component | Target File | Suggested Library | Code Reduction | Impact |
| :--- | :--- | :--- | :--- | :--- |
| **LLM Connector** | `api/chat.js` | `@groq/groq-sdk` | ~40 lines | Eliminates custom retry loops and auth headers. |
| **DB REST Calls** | `api/lib/supabase.js` | `@supabase/supabase-js` | ~25 lines | Replaces manual URL queries with a type-safe client. |
| **Rich Text UX** | `js/ui.js` | `marked` | ~10 lines | Standardizes nested lists, bold formatting, and text links. |
| **PDF Generation** | `js/rendering.js` | `html2pdf.js` | ~30 lines | Generates PDFs directly instead of hijacking browser printing. |
| **UI Icon Sets** | `index.html` | `lucide` | ~50 lines | Replaces inline SVG code blocks with short icon tags. |

**Total Estimated Code Reduction**: **~155 lines of code** saved, while adding robustness, standard error boundaries, and standardizing developer patterns.
