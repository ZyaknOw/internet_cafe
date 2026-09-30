const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Exercise the production session coordinator without needing a browser or
// credentials. Transpilation only strips TypeScript; no behavior is mocked here.
const source = fs.readFileSync(path.join(__dirname, '../lib/session-loader.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function('exports', compiled)(mod.exports);
const { subscribeToSession } = mod.exports;
const wait = (ms = 10) => new Promise(resolve => setTimeout(resolve, ms));
const session = { access_token: 'test-token', user: { id: 'test-user' } };

function setup(fetchProfile, timeout = 1000) {
  let listener;
  let unsubscribed = false;
  const loaded = [], errors = [];
  const cleanup = subscribeToSession({
    onAuthStateChange(callback) {
      listener = callback;
      return { data: { subscription: { unsubscribe() { unsubscribed = true; } } } };
    },
  }, fetchProfile, (...args) => loaded.push(args), error => errors.push(error), timeout);
  return { emit: (...args) => listener(...args), loaded, errors, cleanup, unsubscribed: () => unsubscribed };
}

test('signed-out startup renders without requesting a profile', async () => {
  const h = setup(() => { throw Error('unexpected lookup'); });
  try {
    h.emit('INITIAL_SESSION', null);
    assert.deepEqual(h.loaded, [[null, null]]);
    assert.deepEqual(h.errors, []);
  } finally { h.cleanup(); }
});

test('profile work starts after the auth callback returns', async () => {
  let calls = 0;
  const profile = { role: 'customer', status: 'active' };
  const h = setup(async () => { calls++; return profile; });
  try {
    assert.equal(h.emit('INITIAL_SESSION', session), undefined);
    assert.equal(calls, 0);
    await wait();
    assert.deepEqual(h.loaded, [[session, profile]]);
  } finally { h.cleanup(); }
});

test('missing initial event and stalled profile both stop loading', async () => {
  for (const emit of [false, true]) {
    const h = setup(() => new Promise(() => {}), 25);
    try {
      if (emit) h.emit('INITIAL_SESSION', session);
      await wait(60);
      assert.equal(h.errors.length, 1);
      assert.equal(h.loaded.length, 0);
    } finally { h.cleanup(); }
  }
});

test('profile failure or missing account reports an error', async () => {
  for (const fetcher of [async () => { throw Error('offline'); }, async () => null]) {
    const h = setup(fetcher);
    try {
      h.emit('INITIAL_SESSION', session);
      await wait();
      assert.equal(h.errors.length, 1);
      assert.equal(h.loaded.length, 0);
    } finally { h.cleanup(); }
  }
});

test('late profile cannot restore a signed-out session', async () => {
  let finish;
  const h = setup(() => new Promise(resolve => { finish = resolve; }));
  try {
    h.emit('SIGNED_IN', session);
    await wait();
    h.emit('SIGNED_OUT', null);
    finish({ status: 'active' });
    await wait();
    assert.deepEqual(h.loaded, [[null, null]]);
  } finally { h.cleanup(); }
});

test('late result after timeout is ignored; a later auth event can recover', async () => {
  let finish;
  let calls = 0;
  const h = setup(() => ++calls === 1 ? new Promise(resolve => { finish = resolve; }) : Promise.resolve({ status: 'active' }), 25);
  try {
    h.emit('INITIAL_SESSION', session);
    await wait(60);
    finish({ status: 'active' });
    await wait();
    assert.equal(h.loaded.length, 0);
    h.emit('SIGNED_IN', session);
    await wait();
    assert.equal(h.loaded.length, 1);
  } finally { h.cleanup(); }
});

test('cleanup cancels timers and queued work', async () => {
  let calls = 0;
  const h = setup(async () => { calls++; return {}; }, 25);
  h.emit('INITIAL_SESSION', session);
  h.cleanup();
  await wait(60);
  assert.equal(h.unsubscribed(), true);
  assert.equal(calls, 0);
  assert.deepEqual(h.loaded, []);
  assert.deepEqual(h.errors, []);
});
