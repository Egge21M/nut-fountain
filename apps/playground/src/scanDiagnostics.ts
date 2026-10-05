import { payloadKilobytesPerSecond } from './transferTiming';

export type FrameOutcome = {
  complete: boolean;
  useful: number;
  rank: number;
  fragmentCount?: number;
  format?: 'binary' | 'ur';
  decoderError: boolean;
  tokenValid?: boolean;
  firstValidFrameToCompleteMs?: number;
  payloadBytes?: number;
};
export type ScanSample = {
  atMs: number;
  captureMs: number;
  qrDecodeMs: number;
  workerRoundTripMs: number;
  receiveMs: number;
  totalMs: number;
  found: boolean;
  outcome?: FrameOutcome;
};
export type ScanEnvironment = {
  userAgent: string;
  hardwareConcurrency: number;
  viewport: { width: number; height: number; pixelRatio: number };
  camera: { width?: number; height?: number; frameRate?: number; facingMode?: string; selection?: 'automatic' | 'explicit-device' };
  scheduler: 'video-frame-callback' | 'animation-frame';
  buildTime: string;
};

class Timing {
  private count = 0;
  private sum = 0;
  private max = 0;
  private samples: number[] = [];
  add(ms: number) {
    this.samples[this.count % 2048] = ms;
    this.count++; this.sum += ms; this.max = Math.max(this.max, ms);
  }
  summary() {
    const sorted = this.samples.slice().sort((a, b) => a - b);
    const percentile = (p: number) => sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)] ?? 0;
    return { count: this.count, meanMs: this.count ? this.sum / this.count : 0,
      maxMs: this.max, medianMs: percentile(0.5), p95Ms: percentile(0.95),
      percentileSampleCount: sorted.length };
  }
}

type Bucket = { second: number; attempts: number; qrReads: number; usefulEquations: number };

/** Bounded, allowlisted metrics only. Never accepts pixels, QR bytes, or token text. */
export class ScanDiagnostics {
  callbacks = 0;
  busySkipped = 0;
  repeatedVideoFrames = 0;
  presentedFrameGaps = 0;
  attempts = 0;
  private firstPresented?: number;
  private lastPresented?: number;
  private samples = 0;
  private qrReads = 0;
  private usefulEquations = 0;
  private noProgressReads = 0;
  private decoderErrors = 0;
  private firstQrMs?: number;
  private firstUsefulMs?: number;
  private lastOutcome?: FrameOutcome;
  private captureSize = { width: 0, height: 0 };
  private timings = { captureMs: new Timing(), qrDecodeMs: new Timing(), workerRoundTripMs: new Timing(),
    receiveMs: new Timing(), totalMs: new Timing() };
  private buckets: Bucket[] = [];
  constructor(private environment: ScanEnvironment, private startedAt: string, private startupMs: number) {}

  presented(frame: number) {
    this.firstPresented ??= frame;
    if (this.lastPresented !== undefined) this.presentedFrameGaps += Math.max(0, frame - this.lastPresented - 1);
    this.lastPresented = frame;
  }
  captured(width: number, height: number) { this.attempts++; this.captureSize = { width, height }; }
  record(sample: ScanSample) {
    this.samples++;
    for (const key of Object.keys(this.timings) as (keyof typeof this.timings)[]) this.timings[key].add(sample[key]);
    if (sample.found) { this.qrReads++; this.firstQrMs ??= sample.atMs; }
    const useful = sample.outcome?.useful ?? 0;
    this.usefulEquations += useful;
    if (useful > 0) this.firstUsefulMs ??= sample.atMs;
    if (sample.found && useful === 0) this.noProgressReads++;
    if (sample.outcome?.decoderError) this.decoderErrors++;
    // Explicit projection prevents callers from accidentally adding token fields.
    if (sample.outcome) {
      const { complete, useful, rank, fragmentCount, format, decoderError, tokenValid, firstValidFrameToCompleteMs, payloadBytes } = sample.outcome;
      this.lastOutcome = { complete, useful, rank, fragmentCount, format, decoderError, tokenValid, firstValidFrameToCompleteMs, payloadBytes };
    }
    const second = Math.floor(sample.atMs / 1000);
    let bucket = this.buckets.at(-1);
    if (!bucket || bucket.second !== second) {
      bucket = { second, attempts: 0, qrReads: 0, usefulEquations: 0 };
      this.buckets.push(bucket);
      if (this.buckets.length > 600) this.buckets.shift();
    }
    bucket.attempts++; bucket.qrReads += Number(sample.found); bucket.usefulEquations += useful;
  }
  finish(elapsedMs: number, reason: 'complete' | 'stopped' | 'error') {
    const seconds = elapsedMs / 1000;
    return {
      schemaVersion: 1, scannerVersion: 5, startedAt: this.startedAt, reason,
      environment: this.environment,
      configuration: { decoder: 'jsQR-worker', maxCaptureSide: 720, inversionAttempts: 'dontInvert', maxInFlight: 1 },
      cameraStartupMs: this.startupMs, activeDurationMs: elapsedMs, captureSize: { ...this.captureSize },
      counts: { callbacks: this.callbacks, attempts: this.attempts, completedAttempts: this.samples,
        qrReads: this.qrReads, usefulEquations: this.usefulEquations, noProgressReads: this.noProgressReads,
        decoderErrors: this.decoderErrors, busySkipped: this.busySkipped,
        repeatedVideoFrames: this.repeatedVideoFrames, presentedFrameGaps: this.presentedFrameGaps,
        observedPresentedFrames: this.firstPresented === undefined ? undefined : this.lastPresented! - this.firstPresented + 1 },
      rates: { attemptsPerSecond: seconds ? this.samples / seconds : 0,
        qrReadsPerSecond: seconds ? this.qrReads / seconds : 0,
        usefulEquationsPerSecond: seconds ? this.usefulEquations / seconds : 0 },
      firstQrMs: this.firstQrMs, firstUsefulMs: this.firstUsefulMs,
      firstValidFrameToCompleteMs: this.lastOutcome?.complete ? this.lastOutcome.firstValidFrameToCompleteMs : undefined,
      payloadBytes: this.lastOutcome?.complete ? this.lastOutcome.payloadBytes : undefined,
      payloadKilobytesPerSecond: this.lastOutcome?.complete
        ? payloadKilobytesPerSecond(this.lastOutcome.payloadBytes, this.lastOutcome.firstValidFrameToCompleteMs) : undefined,
      transfer: this.lastOutcome ? { ...this.lastOutcome } : undefined,
      timings: Object.fromEntries(Object.entries(this.timings).map(([key, value]) => [key, value.summary()])),
      timeline: this.buckets.map(bucket => ({ ...bucket })),
      notes: ['No token contents, QR payloads, pixels, mint URLs, camera identifiers, or checksums are included.',
        'Rates cover active camera time, including time spent aiming; startup is separate.',
        'firstValidFrameToCompleteMs measures reader wall time from receipt of its first accepted fountain frame through completed validation. It excludes aiming before that frame, includes pauses between camera sessions or image imports, and is absent until completion.',
        'Payload rate is reconstructed payload bytes divided by firstValidFrameToCompleteMs (decimal kB/s). It excludes framing and duplicate QR overhead, and is absent for incomplete or zero-duration transfers.',
        'Timing percentiles cover the last 2048 completed attempts; means/maxima cover the whole session.',
        'Timeline contains at most the last 600 occupied one-second buckets, counted at result delivery.',
        'Presented-frame gaps are camera presentation gaps, not lost sender QR frames.',
        'Useful equations count positive rank changes during this camera session; existing reader progress is not included.'],
    };
  }
}
export type ScanReport = ReturnType<ScanDiagnostics['finish']>;
