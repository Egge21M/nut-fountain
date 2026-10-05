/** Wall time for one reader transfer, independent of camera sessions and image imports. */
export class TransferTiming {
  private firstAcceptedAt?: number;
  private completedDurationMs?: number;
  get durationMs(): number | undefined { return this.completedDurationMs; }

  record(receivedAt: number, processedAt: number, accepted: boolean, complete: boolean): void {
    if (accepted) this.firstAcceptedAt ??= receivedAt;
    if (complete && this.firstAcceptedAt !== undefined) {
      this.completedDurationMs ??= processedAt - this.firstAcceptedAt;
    }
  }
  reset(): void { this.firstAcceptedAt = undefined; this.completedDurationMs = undefined; }
}

/** Decimal kB/s of reconstructed payload; excludes fountain/QR overhead and duplicates. */
export function payloadKilobytesPerSecond(payloadBytes: number | undefined, durationMs: number | undefined): number | undefined {
  return payloadBytes !== undefined && durationMs !== undefined && durationMs > 0
    ? payloadBytes / durationMs : undefined;
}
