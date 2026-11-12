const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { createRequestHandler } = require('../lib/request-handler.cjs');
const { startRuntime } = require('../lib/runtime-server.cjs');

// Fake configuration is sufficient for these routes; no Supabase requests occur.
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'test-only-key';
process.env.FRONTEND_URL = 'https://internetcafe.bscs4a.com';
const { app } = require('../backend/dist/server.js');
app.post('/api/test-body', (req, res) => res.json(req.body));

test('a hosting loader requiring the entry file starts the listener', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const vm = require('node:vm');
  const starts = [];
  const loaderRequire = (name) => {
    if (name === './lib/runtime-server.cjs') return {
      startRuntime(options) { starts.push(options); return { ready: Promise.resolve() }; },
    };
    return require(name);
  };
  // Under a hosting loader, require.main is the loader, not this entry module.
  loaderRequire.main = { filename: 'hosting-loader.js' };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8'), {
    require: loaderRequire, module: { exports: {} },
    __dirname: path.join(__dirname, '..'), console,
    process: { env: { PORT: '3210' }, on() {}, exit() { assert.fail('Startup failed'); } },
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(starts.length, 1);
  assert.equal(starts[0].port, 3210);
  assert.equal(typeof starts[0].loadApi, 'function');
  assert.equal(typeof starts[0].loadWebsite, 'function');
});

async function listenForTest(t, options) {
  const runtime = startRuntime({ port: 0, hostname: '127.0.0.1', log() {}, ...options });
  t.after(() => new Promise(resolve => {
    runtime.server.close(resolve);
    runtime.server.closeAllConnections();
  }));
  await new Promise(resolve => runtime.server.once('listening', resolve));
  return { ...runtime, origin: `http://127.0.0.1:${runtime.server.address().port}` };
}

test('a stalled Next initialization does not prevent the listener or health checks responding', async (t) => {
  let releaseNext;
  const nextReady = new Promise(resolve => { releaseNext = resolve; });
  const { origin, ready, server } = await listenForTest(t, {
    loadApi: () => app,
    loadWebsite: () => nextReady,
  });
  assert.equal(server.listening, true);
  const live = await fetch(`${origin}/health/live`);
  assert.equal(live.status, 200);
  assert.deepEqual(await live.json(), { ok: true, status: 'starting' });
  const page = await fetch(`${origin}/`);
  assert.equal(page.status, 503);
  assert.equal(page.headers.get('retry-after'), '5');
  assert.deepEqual(await page.json(), { error: 'Application is starting' });
  assert.equal((await fetch(`${origin}/health/ready`)).status, 503);
  releaseNext((_req, res) => res.end('website ready'));
  await ready;
  assert.equal((await fetch(`${origin}/health/ready`)).status, 200);
  assert.deepEqual(await (await fetch(`${origin}/health`)).json(), { ok: true });
  assert.equal(await (await fetch(`${origin}/`)).text(), 'website ready');
});

test('initialization failure records its stage and never exposes error details over HTTP', async (t) => {
  const failure = new Error('private configuration detail');
  const runtime = startRuntime({
    port: 0, hostname: '127.0.0.1', log() {},
    loadApi() { throw failure; }, loadWebsite() { assert.fail('Must not initialize Next'); },
  });
  const rejected = assert.rejects(runtime.ready, error => {
    assert.equal(error.message, 'Startup failed at loading-api');
    assert.equal(error.cause, failure);
    return true;
  });
  t.after(() => new Promise(resolve => {
    runtime.server.close(resolve); runtime.server.closeAllConnections();
  }));
  await rejected;
  const origin = `http://127.0.0.1:${runtime.server.address().port}`;
  const response = await fetch(origin);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'Application startup failed' });
});

test('stalled initialization rejects at a deadline with the blocked stage', async (t) => {
  const runtime = startRuntime({
    port: 0, hostname: '127.0.0.1', log() {}, startupTimeoutMs: 100,
    loadApi: () => app, loadWebsite: () => new Promise(() => {}),
  });
  t.after(() => new Promise(resolve => runtime.server.close(resolve)));
  await assert.rejects(runtime.ready, error => {
    assert.equal(error.message, 'Startup failed at preparing-next');
    assert.equal(error.cause.message, 'Startup exceeded its deadline');
    return true;
  });
});

test('one listener serves API, health, and website requests without consuming page bodies', async (t) => {
  const websiteRequests = [];
  const server = createServer(createRequestHandler(app, async (req, res) => {
    websiteRequests.push(req.url);
    let body = '';
    for await (const chunk of req) body += chunk;
    res.end(`website:${req.url}:${body}`);
  }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const origin = `http://127.0.0.1:${server.address().port}`;

  const health = await fetch(`${origin}/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true });

  const me = await fetch(`${origin}/api/me`, {
    headers: { Origin: 'https://internetcafe.bscs4a.com' },
  });
  assert.equal(me.status, 401);
  for (const route of ['/api/admin/activity', '/api/admin/reports']) {
    assert.equal((await fetch(`${origin}${route}`)).status, 401);
  }
  assert.equal(me.headers.get('access-control-allow-origin'), 'https://internetcafe.bscs4a.com');

  const posted = await fetch(`${origin}/api/test-body`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: 42 }),
  });
  assert.deepEqual(await posted.json(), { value: 42 });

  const missing = await fetch(`${origin}/api/does-not-exist`);
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: 'API endpoint not found' });

  for (const route of ['/', '/admin/dashboard', '/_next/static/example.js', '/apiary']) {
    assert.equal(await (await fetch(`${origin}${route}`)).text(), `website:${route}:`);
  }
  const action = await fetch(`${origin}/login`, { method: 'POST', body: 'page-action-body' });
  assert.equal(await action.text(), 'website:/login:page-action-body');
  assert.equal(websiteRequests.length, 5);
});
