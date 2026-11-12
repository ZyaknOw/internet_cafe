const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { reportAnalytics } = require('../../backend/dist/report-analytics.js');
const source = fs.readFileSync(path.join(__dirname, '../components/admin-portal/report-analytics-panel.tsx'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const mod = { exports: {} };
new Function('exports', 'require', compiled)(mod.exports, name => name.endsWith('.css') ? {} : require(name));

test('charts render accessible SVGs and exact data without React title warnings or fabricated forecasts', () => {
  const warnings = [];
  const originalError = console.error;
  console.error = (...args) => warnings.push(args.join(' '));
  let html;
  try {
    const range = { start: new Date('2026-11-11T16:00:00Z'), end: new Date('2026-11-12T16:00:00Z') };
    const data = reportAnalytics([], [], range, 'daily', range.end);
    html = renderToStaticMarkup(React.createElement(mod.exports.ReportAnalyticsPanel, { data }));
  } finally { console.error = originalError; }
  assert.deepEqual(warnings, []);
  assert.equal((html.match(/<svg /g) || []).length, 2);
  assert.equal((html.match(/role="img"/g) || []).length, 2);
  assert.ok(html.includes('Insufficient historical data'));
  assert.ok(html.includes('View exact chart data'));
  assert.ok(html.includes('snacks and wallet top-ups are excluded'));
});
