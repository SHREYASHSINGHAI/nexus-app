import handler from '../api/config.js';

async function testConfig() {
  console.log('--- Testing Config API Component ---');

  function createMockRes() {
    return {
      statusCode: 200,
      headers: {},
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; },
      setHeader(name, val) { this.headers[name] = val; }
    };
  }

  try {
    const req = {};
    const res = createMockRes();
    handler(req, res);
    if (res.statusCode !== 200) throw new Error(`Expected status 200, got ${res.statusCode}`);
    if (res.headers['Access-Control-Allow-Origin'] !== '*') throw new Error('CORS header missing.');
    console.log('✓ Test 1 Passed: Config API returns status 200 and allows CORS.');
  } catch (err) {
    // Error: Config API handler failed when reading environment variables or writing response.
    console.error('✗ Test 1 Failed:', err.message);
    process.exit(1);
  }
}

testConfig();
