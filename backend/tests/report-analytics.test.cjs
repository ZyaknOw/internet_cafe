const { test } = require('node:test');
const assert = require('node:assert/strict');
const { reportAnalytics, previousReportRange } = require('../dist/report-analytics.js');
const range = { start: new Date('2026-11-11T16:00:00Z'), end: new Date('2026-11-12T16:00:00Z') };
const paid = (ended_at, total) => ({ ended_at, total, checkout_total: null });

test('daily chart uses Manila hour boundaries, saved PC checkout revenue and zero-filled intervals', () => {
  const rows = [paid('2026-11-11T16:00:00Z', 10), paid('2026-11-11T17:30:00Z', 20),
    { ...paid('2026-11-11T18:30:00Z', 999), checkout_total: 30 },
    paid('2026-11-12T16:00:00Z', 500)];
  const data = reportAnalytics(rows, [paid('2026-11-10T18:00:00Z', 40)], range, 'daily', range.end);
  assert.equal(data.buckets.length, 24);
  assert.equal(data.buckets[0].label, '12 AM');
  assert.deepEqual(data.buckets.slice(0, 3).map(row => row.revenue), [10, 20, 30]);
  assert.equal(data.buckets[3].revenue, 0);
  assert.equal(data.statistics.averageTicket, 20);
  assert.equal(data.statistics.peakRevenueInterval, '2 AM');
  assert.equal(data.comparison.revenueChange, 20);
  assert.equal(data.comparison.revenueChangePercent, 50);
  assert.equal(data.projection.revenue, 60);
});

test('projection excludes the current unfinished interval and does not treat future intervals as zero observations', () => {
  const rows = [paid('2026-11-11T16:10:00Z', 10), paid('2026-11-11T17:10:00Z', 10),
    paid('2026-11-11T18:10:00Z', 10), paid('2026-11-11T19:10:00Z', 1000)];
  const data = reportAnalytics(rows, [], range, 'daily', new Date('2026-11-11T19:30:00Z'));
  assert.equal(data.projection.completedBuckets, 3);
  assert.equal(data.projection.completedSessions, 3);
  assert.equal(data.projection.revenue, 240);
  assert.equal(data.comparison.currentPeriodComplete, false);
  assert.equal(data.comparison.revenueChangePercent, null);
});

test('empty or sparse history does not invent forecasts or growth percentages', () => {
  const empty = reportAnalytics([], [], range, 'daily', range.end);
  assert.equal(empty.projection.revenue, null);
  assert.equal(empty.statistics.peakRevenueInterval, null);
  assert.equal(empty.statistics.averageTicket, 0);
  assert.equal(empty.comparison.revenueChangePercent, null);
  const sparse = reportAnalytics([paid('2026-11-11T18:00:00Z', 50)], [], range, 'daily', range.end);
  assert.equal(sparse.projection.revenue, null);
});

test('calendar comparisons and projections handle different month lengths and leap years', () => {
  const feb = { start: new Date('2028-01-31T16:00:00Z'), end: new Date('2028-02-29T16:00:00Z') };
  const previous = previousReportRange(feb, 'monthly');
  assert.equal(previous.start.toISOString(), '2027-12-31T16:00:00.000Z');
  const data = reportAnalytics([paid('2028-02-01T00:00:00Z', 29), paid('2028-02-02T00:00:00Z', 29),
    paid('2028-02-03T00:00:00Z', 29)], [], feb, 'monthly', feb.end);
  assert.equal(data.buckets.length, 29);
  assert.equal(data.projection.revenue, 93);
  assert.equal(data.projection.end, '2028-03-31T16:00:00.000Z');
  const year = { start: new Date('2025-12-31T16:00:00Z'), end: new Date('2026-12-31T16:00:00Z') };
  assert.equal(reportAnalytics([], [], year, 'yearly', year.end).buckets.length, 12);
});
