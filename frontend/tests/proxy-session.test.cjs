const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadProxy(getUser) {
  const source = fs.readFileSync(path.join(__dirname, '../utils/supabase/middleware.ts'), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  const responses = [];
  const requireMock = name => {
    if (name === '@supabase/ssr') return {
      createServerClient: (_url, _key, options) => ({ auth: { getUser: () => getUser(options) } }),
    };
    if (name === 'next/server') return {
      NextResponse: { next: () => {
        const response = { cookies: { set: (...args) => response.writes.push(args) }, writes: [] };
        responses.push(response);
        return response;
      } },
    };
    throw Error(`Unexpected import: ${name}`);
  };
  new Function('require', 'exports', 'setTimeout', code)(requireMock, mod.exports, callback => setTimeout(callback, 25));
  return { createClient: mod.exports.createClient, responses };
}

test('proxy preserves refreshed session cookies', async () => {
  const writes = [];
  const proxy = loadProxy(async options => {
    options.cookies.setAll([{ name: 'test-cookie', value: 'test-value', options: { httpOnly: true } }]);
    return { data: { user: {} } };
  });
  const response = await proxy.createClient({ cookies: { set: (...args) => writes.push(args) } });
  assert.deepEqual(writes, [['test-cookie', 'test-value']]);
  assert.deepEqual(response.writes, [['test-cookie', 'test-value', { httpOnly: true }]]);
});

test('unavailable or stalled auth does not block the public page', async () => {
  for (const getUser of [async () => { throw Error('offline'); }, () => new Promise(() => {})]) {
    const proxy = loadProxy(getUser);
    const response = await proxy.createClient({});
    assert.equal(response, proxy.responses[0]);
    assert.deepEqual(response.writes, []);
  }
});
