import { execSync } from 'child_process';

const components = [
  { name: 'Tavily Search Component', file: 'tests/tavily.test.js' },
  { name: 'Supabase DB Component', file: 'tests/supabase.test.js' },
  { name: 'Chat API Orchestrator', file: 'tests/chat.test.js' },
  { name: 'Config API Endpoint', file: 'tests/config.test.js' },
  { name: 'Share API Endpoint', file: 'tests/share.test.js' },
  { name: 'AI Response Parser', file: 'tests/ai-response.test.js' },
  { name: 'Frontend Client Code', file: 'tests/frontend.test.js' }
];

console.log('Running all modular component tests...\n');
const results = [];

for (const comp of components) {
  try {
    execSync(`node ${comp.file}`, { stdio: 'inherit' });
    results.push({ name: comp.name, status: '✓ PASSED' });
  } catch (err) {
    results.push({ name: comp.name, status: '✗ FAILED' });
  }
}

console.log('\n╔═════════════════════════════════════╦══════════╗');
console.log('║ Component                           ║ Status   ║');
console.log('╠═════════════════════════════════════╬══════════╣');
for (const res of results) {
  const nameCol = res.name.padEnd(35);
  const statusCol = res.status.padEnd(8);
  console.log(`║ ${nameCol} ║ ${statusCol} ║`);
}
console.log('╚═════════════════════════════════════╩══════════╝');
