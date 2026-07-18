import { saveAnalytics } from '../api/lib/supabase.js';

async function testSupabase() {
  console.log('--- Testing Supabase DB Component ---');

  // Test 1: Missing Session ID
  try {
    await saveAnalytics({ sessionId: '', taskDescription: 'Test', meta: {}, messages: [], replyText: '' });
    console.log('✓ Test 1 Passed: Missing session ID handled gracefully without throwing.');
  } catch (err) {
    // Error: Database insertions with empty session IDs must terminate early to avoid constraint errors.
    console.error('✗ Test 1 Failed:', err.message);
    process.exit(1);
  }

  // Test 2: Missing Database Credentials
  const origUrl = process.env.SUPABASE_URL;
  const origKey = process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_URL = '';
  process.env.SUPABASE_ANON_KEY = '';
  try {
    await saveAnalytics({ sessionId: 'session-123', taskDescription: 'Test', meta: {}, messages: [], replyText: '' });
    console.log('✓ Test 2 Passed: Missing database credentials handled without throwing.');
  } catch (err) {
    // Error: Uninitialized database clients must be caught early to prevent database operations from referencing null objects.
    console.error('✗ Test 2 Failed:', err.message);
    process.exit(1);
  } finally {
    process.env.SUPABASE_URL = origUrl;
    process.env.SUPABASE_ANON_KEY = origKey;
  }
}

testSupabase();
