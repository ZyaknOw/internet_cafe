// Local-only visual QA. All figures here are synthetic fixtures, never production data.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { createServer } = require('node:http');
const root = path.resolve(__dirname, '..');
const frontendRequire = createRequire(path.join(root, 'frontend/package.json'));
const ts = frontendRequire('typescript');
const React = frontendRequire('react');
const { renderToStaticMarkup } = frontendRequire('react-dom/server');
const { reportAnalytics } = require('../backend/dist/report-analytics.js');
const file = path.join(root, 'frontend/components/admin-portal/report-analytics-panel.tsx');
const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const mod = { exports: {} };
new Function('exports', 'require', compiled)(mod.exports, name => name.endsWith('.css') ? {} : frontendRequire(name));
const range = { start: new Date('2026-01-14T16:00:00Z'), end: new Date('2026-01-15T16:00:00Z') };
const rows = Array.from({ length: 40 }, (_, index) => ({
  ended_at: new Date(range.start.getTime() + ((index * 37) % 1440) * 60_000).toISOString(),
  checkout_total: 20 + index % 7 * 10,
}));
const data = reportAnalytics(rows, [{ ended_at: '2026-01-14T00:00:00Z', total: 1500 }], range, 'daily', range.end);
const css = ['admin-portal.css', 'rubric-panels.css'].map(name =>
  fs.readFileSync(path.join(root, 'frontend/components/admin-portal', name), 'utf8')).join('\n');
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rubric report preview</title><style>${css}body{margin:0;background:#f4f7f4;font-family:Arial,sans-serif}main{max-width:1180px;margin:auto;padding:28px}h1{color:#143d28;font-size:24px}header p{color:#607569;font-size:13px}</style>
<main><header><h1>PC Revenue Reports</h1><p>LOCAL VISUAL QA — SYNTHETIC TEST FIXTURES ONLY</p></header>
${renderToStaticMarkup(React.createElement(mod.exports.ReportAnalyticsPanel, { data }))}</main></html>`;
createServer((_req, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html); })
  .listen(4318, '127.0.0.1', () => console.log('Local QA preview: http://127.0.0.1:4318'));
