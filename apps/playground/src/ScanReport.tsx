import { useState } from 'react';
import type { ScanReport as Report } from './scanDiagnostics';

export function ScanReport({ report }: { report: Report }) {
  const [senderFps, setSenderFps] = useState('');
  const download = () => {
    const rate = Number(senderFps);
    const data = { ...report, testConditions: {
      senderFps: senderFps && Number.isFinite(rate) && rate > 0 && rate <= 120 ? rate : undefined,
    } };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = `nut-fountain-scan-${report.startedAt.replace(/[:.]/g, '-')}.json`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section className="panel scan-report" aria-label="Scan diagnostics">
    <h2>Scan diagnostics</h2>
    <p className="body-copy">{report.rates.attemptsPerSecond.toFixed(1)} scans/s · {report.rates.qrReadsPerSecond.toFixed(1)} QR reads/s · {report.rates.usefulEquationsPerSecond.toFixed(1)} useful frames/s</p>
    <p className="field-note">Download timings and device information to compare scans. The report contains no token contents or camera images and is not uploaded.</p>
    <label>Sender frame rate (optional)<input type="number" min="1" max="120" step="1" value={senderFps}
      onChange={event => setSenderFps(event.target.value)} placeholder="FPS shown on the sender" /></label>
    <button className="button secondary" onClick={download}>Download scan diagnostics</button>
  </section>;
}
