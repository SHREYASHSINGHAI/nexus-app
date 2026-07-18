import fs from 'fs';
import path from 'path';
import vm from 'vm';

async function testFrontend() {
  console.log('--- Testing Frontend Components ---');

  const sandbox = {
    console,
    setTimeout,
    crypto: {
      randomUUID() { return 'mock-uuid-1234'; }
    },
    marked: {
      parse(text) { return `<p>${text}</p>`; }
    },
    localStorage: {
      store: {},
      getItem(key) { return this.store[key] || null; },
      setItem(key, val) { this.store[key] = String(val); }
    },
    document: {
      body: {
        classList: {
          classes: new Set(),
          add(c) { this.classes.add(c); },
          remove(c) { this.classes.delete(c); },
          toggle(c) {
            if (this.classes.has(c)) { this.classes.delete(c); return false; }
            this.classes.add(c); return true;
          },
          contains(c) { return this.classes.has(c); }
        }
      },
      getElementById(id) {
        return {
          id,
          style: {},
          setAttribute(name, val) { this[name] = val; },
          innerHTML: ''
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
    }
  };
  sandbox.window = sandbox;

  vm.createContext(sandbox);

  try {
    // 1. Run js/state.js
    const stateCode = fs.readFileSync(path.resolve('js/state.js'), 'utf8');
    vm.runInContext(stateCode, sandbox, { filename: 'state.js' });
    console.log('✓ State Component: Loaded and executed successfully.');

    // 2. Run js/rendering.js
    const renderingCode = fs.readFileSync(path.resolve('js/rendering.js'), 'utf8');
    vm.runInContext(renderingCode, sandbox, { filename: 'rendering.js' });
    const escResult = sandbox.escHtml('<hello>');
    if (escResult !== '&lt;hello&gt;') {
      throw new Error('Rendering component escHtml failed.');
    }
    console.log('✓ Rendering Component: HTML escaping works.');

    // 3. Run js/ui.js
    const uiCode = fs.readFileSync(path.resolve('js/ui.js'), 'utf8');
    vm.runInContext(uiCode, sandbox, { filename: 'ui.js' });
    const bulletResult = sandbox.formatBullets('• Line 1');
    if (!bulletResult.includes('<p>')) {
      throw new Error('UI component formatBullets failed to call marked.parse.');
    }
    console.log('✓ UI Component: formatBullets integrates with marked correctly.');

  } catch (err) {
    // Error: Browser mock sandbox execution failed due to undefined reference or missing DOM structures.
    console.error('✗ Frontend Test Failed:', err.message);
    process.exit(1);
  }
}

testFrontend();
