const fs = require('fs');
const path = require('path');

// Helper to find and read .env.local
let envContent = '';
const pathsToTry = [
  path.join(__dirname, '.env.local'),
  path.join(__dirname, '..', '.env.local'),
  path.join(process.cwd(), '.env.local')
];

let foundPath = null;
for (const p of pathsToTry) {
  if (fs.existsSync(p)) {
    envContent = fs.readFileSync(p, 'utf8');
    foundPath = p;
    break;
  }
}

if (!foundPath) {
  console.error('Could not find .env.local in any of the searched paths:', pathsToTry);
  process.exit(1);
}

console.log(`Loaded environment from: ${foundPath}`);

// Extract GROQ_API_KEY
const lines = envContent.split(/\r?\n/);
const groqLine = lines.find(l => l.trim().startsWith('GROQ_API_KEY='));

if (!groqLine) {
  console.error('GROQ_API_KEY not found in .env.local');
  process.exit(1);
}

const rawKey = groqLine.split('=')[1].trim();

// Test 1: Literal Key as written in .env.local (might contain quotes)
console.log('\n--- Test 1: Testing key exactly as written in .env.local (with quotes if present) ---');
console.log(`Raw value: "${rawKey}"`);
testKey(rawKey);

// Test 2: Stripped Key (removing any quotes)
const strippedKey = rawKey.replace(/^["']|["']$/g, '');
if (strippedKey !== rawKey) {
  console.log('\n--- Test 2: Testing key with surrounding quotes removed ---');
  console.log(`Stripped value: "${strippedKey}"`);
  testKey(strippedKey);
}

function testKey(key) {
  fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: 'Say hello in 5 words.' }]
    })
  })
    .then(async res => {
      const isJson = res.headers.get('content-type')?.includes('application/json');
      const text = await res.text();
      console.log(`\nResponse Status: ${res.status}`);
      if (res.ok) {
        if (isJson) {
          const json = JSON.parse(text);
          console.log('SUCCESS! Groq response:', json.choices[0].message.content);
        } else {
          console.log('SUCCESS (Non-JSON response):', text);
        }
      } else {
        console.error('FAILED! Groq error response:');
        try {
          console.error(JSON.stringify(JSON.parse(text), null, 2));
        } catch (_) {
          console.error(text);
        }
      }
    })
    .catch(err => {
      console.error('Network error requesting Groq API:', err.message);
    });
}
