import { expect, test } from 'bun:test';
import { TransferTiming, payloadKilobytesPerSecond } from '../src/transferTiming';
import { FountainEncoder, FountainDecoder } from 'nut-fountain/core';

test('reader timing excludes invalid input and aiming, includes pauses, and freezes at completion', () => {
  const clock = new TransferTiming();
  clock.record(10, 15, false, false); // A QR was read but not a valid fountain frame.
  const encoder = new FountainEncoder(Uint8Array.of(1, 2), { fragmentSize: 1 });
  const decoder = new FountainDecoder();
  const first = encoder.nextFrame();
  clock.record(1000, 1004, decoder.receive(first), decoder.isComplete);
  expect(clock.durationMs).toBeUndefined();
  clock.record(1200, 1204, decoder.receive(first), decoder.isComplete);
  // A camera pause does not reset the reader's transfer clock.
  clock.record(5000, 5007, decoder.receive(encoder.nextFrame()), decoder.isComplete);
  expect(clock.durationMs).toBe(4007);
  clock.record(6000, 6004, decoder.receive(first), decoder.isComplete);
  expect(clock.durationMs).toBe(4007);
});

test('reset clears an unfinished/finished transfer and single-frame timing includes validation', () => {
  const clock = new TransferTiming();
  clock.record(10, 12, true, false);
  clock.reset(); // Explicit reader reset or failed reconstructed UR session.
  expect(clock.durationMs).toBeUndefined();
  clock.record(100, 107, true, true);
  expect(clock.durationMs).toBe(7);
  clock.reset();
  expect(clock.durationMs).toBeUndefined();
  clock.record(200, 205, false, false);
  expect(clock.durationMs).toBeUndefined();
});

test('payload throughput uses decimal kB/s and omits incomplete or zero-duration transfers', () => {
  expect(payloadKilobytesPerSecond(3000, 1500)).toBe(2);
  expect(payloadKilobytesPerSecond(3000, undefined)).toBeUndefined();
  expect(payloadKilobytesPerSecond(undefined, 1500)).toBeUndefined();
  expect(payloadKilobytesPerSecond(3000, 0)).toBeUndefined();
});
