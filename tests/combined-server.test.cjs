const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { createRequestHandler } = require('../server.js');

// Fake configuration is sufficient for these routes; no Supabase requests occur.
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'test-only-key';
process.env.FRONTEND_URL = 'https://internetcafe.bscs4a.com';
const { app } = require('../backend/dist/server.js');
app.post('/api/test-body', (req, res) => res.json(req.body));

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
