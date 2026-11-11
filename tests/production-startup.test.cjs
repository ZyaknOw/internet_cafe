const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { createServer } = require('node:net');
const { once } = require('node:events');
const path = require('node:path');
const os = require('node:os');

// Requires the compiled backend and a completed production frontend build.
for (const mode of ['direct', 'hosting-loader']) {
  test(`production ${mode} starts from an unrelated working directory`, { timeout: 30_000 }, async (t) => {
    const probe = createServer();
    probe.listen(0, '127.0.0.1');
    await once(probe, 'listening');
    const port = probe.address().port;
    await new Promise(resolve => probe.close(resolve));
    const entry = path.resolve(__dirname, '../server.js');
    const args = mode === 'direct' ? [entry] : ['-e', `require(${JSON.stringify(entry)})`];
    const child = spawn(process.execPath, args, {
      cwd: os.tmpdir(), windowsHide: true,
      env: { ...process.env, PORT: String(port),
        SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'test-only-key' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let logs = '';
    child.stdout.on('data', chunk => { logs += chunk; });
    child.stderr.on('data', chunk => { logs += chunk; });
    t.after(async () => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    });
    const origin = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      assert.equal(child.exitCode, null, `Server exited before ready:\n${logs}`);
      try {
        const res = await fetch(`${origin}/health/ready`, { signal: AbortSignal.timeout(1000) });
        if (res.status === 200) { ready = true; break; }
      } catch { /* The child may not have bound its socket yet. */ }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, `Server did not become ready:\n${logs}`);
    assert.equal((await fetch(`${origin}/`)).status, 200);
    assert.deepEqual(await (await fetch(`${origin}/health`)).json(), { ok: true });
    assert.equal((await fetch(`${origin}/api/me`)).status, 401);
    assert.equal((await fetch(`${origin}/api/unknown`)).status, 404);
    for (const stage of ['entry-loaded', 'listening', 'loading-api', 'preparing-next', 'ready']) {
      assert.ok(logs.includes(`[startup] ${stage}`), `Missing startup stage: ${stage}`);
    }
  });
}
