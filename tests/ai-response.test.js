import fs from 'fs';
import path from 'path';
import vm from 'vm';

async function testAIResponseParsing() {
  console.log('--- Testing AI Response Parsing ---');

  const sandbox = {
    console,
    setTimeout,
    lastRecommendationData: null,
    currentUser: null,
    AI_TOOLS_DB: { writing: [], coding: [] },
    document: {
      getElementById(id) {
        return {
          id,
          innerHTML: '',
          appendChild(el) {}
        };
      },
      createElement(tag) {
        return {
          tag,
          style: {},
          setAttribute(name, val) { this[name] = val; },
          appendChild(el) {},
          className: '',
          innerHTML: ''
        };
      }
    },
    makeEl(tag, cls, text='') {
      return { tag, cls, text, appendChild() {} };
    },
    renderSingle() {},
    renderPipeline() {}
  };

  const renderingCode = fs.readFileSync(path.resolve('js/rendering.js'), 'utf8');
  vm.createContext(sandbox);
  vm.runInContext(renderingCode, sandbox);

  // Test 1: Extract options from AI response
  try {
    const mockReply = "Based on your task, pick:\n|||OPTIONS_START\n[\"Option 1\", \"Option 2\"]\n|||OPTIONS_END";
    const options = sandbox.parseOptions(mockReply);
    if (!options || options[0] !== 'Option 1') throw new Error('Failed to parse OPTIONS block.');
    console.log('✓ Test 1 Passed: Options correctly extracted.');
  } catch (err) {
    // Error: Options parser failed to extract option array from OPTIONS markers.
    console.error('✗ Test 1 Failed:', err.message);
    process.exit(1);
  }

  // Test 2: Strip markers from response
  try {
    const mockReply = "Here is advice. |||OPTIONS_START\n[\"Option 1\"]\n|||OPTIONS_END |||JSON_START\n{}\n|||JSON_END";
    const cleaned = sandbox.stripMarkers(mockReply);
    if (cleaned !== 'Here is advice.') throw new Error(`Failed to strip markers correctly: "${cleaned}"`);
    console.log('✓ Test 2 Passed: JSON and OPTIONS markers successfully stripped.');
  } catch (err) {
    // Error: AI response cleaner failed to strip structural metadata block markers.
    console.error('✗ Test 2 Failed:', err.message);
    process.exit(1);
  }

  // Test 3: Parse and render tool recommendations JSON block
  try {
    const mockJson = JSON.stringify({
      mode: 'single',
      domain: 'writing',
      reasoning: 'Matches writing task.',
      tools: ['Claude (Anthropic)'],
      scores: [95]
    });
    const mockReply = `Here are recommendations:\n|||JSON_START\n${mockJson}\n|||JSON_END`;
    const result = sandbox.parseAndRenderTools(mockReply);
    if (result !== 'Here are recommendations:') throw new Error('Failed to return stripped reply.');
    if (sandbox.lastRecommendationData.domain !== 'writing') throw new Error('Cached recommendation data mismatch.');
    console.log('✓ Test 3 Passed: AI recommendations JSON parsed and cached successfully.');
  } catch (err) {
    // Error: AI response JSON block parser failed to parse recommendations config.
    console.error('✗ Test 3 Failed:', err.message);
    process.exit(1);
  }
}

testAIResponseParsing();
