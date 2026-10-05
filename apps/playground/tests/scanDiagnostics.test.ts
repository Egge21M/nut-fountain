import { expect, test } from 'bun:test';
import { ScanDiagnostics, type ScanSample } from '../src/scanDiagnostics';

const environment = { userAgent: 'test-browser', hardwareConcurrency: 4,
  viewport: { width: 390, height: 844, pixelRatio: 2 }, camera: { width: 1280, height: 720, frameRate: 30 },
  scheduler: 'video-frame-callback' as const, buildTime: 'test' };
const sample = (atMs: number, useful: number): ScanSample => ({ atMs, captureMs: 2, qrDecodeMs: 5,
  workerRoundTripMs: 7, receiveMs: 1, totalMs: 10, found: true,
  outcome: { complete: false, useful, rank: 1, fragmentCount: 4, format: 'binary', decoderError: false } });

test('diagnostics distinguish attempts, QR reads, useful equations and camera gaps without token data', () => {
  const metrics = new ScanDiagnostics(environment, '2026-10-05T00:00:00Z', 100);
  metrics.presented(20); metrics.presented(23);
  metrics.captured(720, 405); metrics.record(sample(500, 1));
  metrics.captured(720, 405); metrics.record(sample(1000, 0));
  const empty = sample(1500, 0); empty.found = false; empty.outcome = undefined;
  metrics.captured(720, 405); metrics.record(empty);
  const final = sample(2000, 1);
  Object.assign(final.outcome!, { token: 'cashuBsecret', pixels: [1, 2, 3], complete: true, rank: 2, firstValidFrameToCompleteMs: 1500, payloadBytes: 3000 });
  metrics.captured(720, 405); metrics.record(final);
  const report = metrics.finish(2000, 'complete');
  expect(report.counts.qrReads).toBe(3);
  expect(report.counts.usefulEquations).toBe(2);
  expect(report.counts.noProgressReads).toBe(1);
  expect(report.counts.presentedFrameGaps).toBe(2);
  expect(report.rates).toEqual({ attemptsPerSecond: 2, qrReadsPerSecond: 1.5, usefulEquationsPerSecond: 1 });
  expect(report.timings.qrDecodeMs!.meanMs).toBe(5);
  expect(report.firstUsefulMs).toBe(500);
  expect(report.firstValidFrameToCompleteMs).toBe(1500);
  expect(report.payloadBytes).toBe(3000);
  expect(report.payloadKilobytesPerSecond).toBe(2);
  expect(JSON.stringify(report)).not.toContain('cashuBsecret');
  expect(report.transfer).not.toHaveProperty('pixels');
});

test('long scans retain bounded timelines and percentile samples while keeping lifetime totals', () => {
  const metrics = new ScanDiagnostics(environment, 'test', 0);
  for (let i = 0; i < 3000; i++) { metrics.captured(720, 405); metrics.record(sample(i * 1000, 1)); }
  const report = metrics.finish(3000000, 'stopped');
  expect(report.firstValidFrameToCompleteMs).toBeUndefined();
  expect(report.payloadKilobytesPerSecond).toBeUndefined();
  expect(report.timeline.length).toBe(600);
  expect(report.timings.totalMs!.percentileSampleCount).toBe(2048);
  expect(report.timings.totalMs!.count).toBe(3000);
  expect(report.counts.usefulEquations).toBe(3000);
  expect(report.rates.usefulEquationsPerSecond).toBe(1);
  expect(new ScanDiagnostics(environment, 'test', 0).finish(0, 'stopped').rates.attemptsPerSecond).toBe(0);
});
