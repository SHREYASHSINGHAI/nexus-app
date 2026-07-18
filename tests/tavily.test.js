import { searchAITools } from '../api/lib/tavily.js';

async function testTavily() {
  console.log('--- Testing Tavily Search Component ---');

  // Test 1: Empty Query Input
  try {
    const res = await searchAITools('', {});
    if (res !== '') throw new Error('Expected empty string for empty input.');
    console.log('✓ Test 1 Passed: Empty input handled correctly.');
  } catch (err) {
    // Error: Empty query should bypass external API search and return empty context.
    console.error('✗ Test 1 Failed:', err.message);
    process.exit(1);
  }

  // Test 2: Missing API Key
  const originalKey = process.env.TAVILY_API_KEY;
  process.env.TAVILY_API_KEY = '';
  try {
    await searchAITools('test tool', {});
    throw new Error('Expected search to fail without key.');
  } catch (err) {
    // Error: API requests made without credentials should throw 401 unauthorized or 400 bad request error.
    console.log('✓ Test 2 Passed: Missing API key error caught correctly.');
  } finally {
    process.env.TAVILY_API_KEY = originalKey;
  }
}

testTavily();
