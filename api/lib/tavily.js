// ============================================================
// NEXUS — api/lib/tavily.js
// Tavily Search Helper for AI Tool Discovery
// ============================================================

export async function searchAITools(taskDescription, meta) {
  if (!taskDescription) return '';

  const domain = meta?.domain || '';
  const budget = meta?.budget || '';
  const query  = buildSearchQuery(taskDescription, domain, budget);

  const tavilyRes = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key:             process.env.TAVILY_API_KEY,
      query:               query,
      search_depth:        'advanced',
      include_domains:     ['theresanaiforthat.com'],
      max_results:         8,
      include_answer:      false,
      include_raw_content: false
    })
  });

  if (!tavilyRes.ok) {
    const err = await tavilyRes.text();
    throw new Error(`Tavily error ${tavilyRes.status}: ${err}`);
  }

  const data = await tavilyRes.json();

  if (!data.results || data.results.length === 0) {
    return await searchAIToolsFallback(query);
  }

  return formatSearchResults(data.results, query);
}

async function searchAIToolsFallback(query) {
  const tavilyRes = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key:        process.env.TAVILY_API_KEY,
      query:          `best AI tools for ${query}`,
      search_depth:   'basic',
      max_results:    6,
      include_answer: false
    })
  });

  if (!tavilyRes.ok) return '';
  const data = await tavilyRes.json();
  if (!data.results?.length) return '';
  return formatSearchResults(data.results, query);
}

function buildSearchQuery(taskDescription, domain, budget) {
  const parts = [];
  parts.push(taskDescription.slice(0, 120));
  if (domain && domain !== 'null') parts.push(domain);
  if (budget && (budget.toLowerCase().includes('free') || budget === 'Free only')) parts.push('free');
  return parts.join(' ');
}

function formatSearchResults(results, query) {
  if (!results || results.length === 0) return '';

  const lines = [
    `Search query: "${query}"`,
    `Found ${results.length} relevant AI tools:\n`
  ];

  results.forEach((r, i) => {
    const title   = (r.title   || 'Unknown Tool').trim();
    const url     = (r.url     || '').trim();
    const snippet = (r.content || r.snippet || '').trim().slice(0, 300);
    lines.push(`${i + 1}. ${title}`);
    if (url)     lines.push(`   URL: ${url}`);
    if (snippet) lines.push(`   Description: ${snippet}`);
    lines.push('');
  });

  return lines.join('\n');
}
