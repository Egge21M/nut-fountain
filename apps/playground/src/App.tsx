import { TransferTiming, payloadKilobytesPerSecond } from './transferTiming';
import { ScanReport } from './ScanReport';
import type { FrameOutcome } from './scanDiagnostics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FountainEncoder, type EncoderMode } from 'nut-fountain/encoder';
import { bytesToToken, bytesToTokenString, tokenToBytes } from 'nut-fountain/cashu';
import { drawFrame, readCanvas, readQrImage } from './qr';
import { makeDemoToken } from './demo';
import { useCamera } from './useCamera';
import { AutoDecoder } from 'nut-fountain/auto';

const demo = makeDemoToken();

function TokenResult({ token, local = false, durationMs, payloadBytes }: { token: string; local?: boolean; durationMs?: number; payloadBytes?: number }) {
  const [copyStatus, setCopyStatus] = useState('');
  const throughput = payloadKilobytesPerSecond(payloadBytes, durationMs);
  const details = bytesToToken(tokenToBytes(token));
  const copy = async () => {
    try { await navigator.clipboard.writeText(token); setCopyStatus('Copied'); }
    catch { setCopyStatus('Select the token below to copy it manually.'); }
  };
  return <section className="result" aria-label="Decoded token">
    <div className="result-heading"><span className="check">✓</span><div>
      <h3>{local ? 'Local QR round trip passed' : 'Token received'}</h3>
      <p>{details.proofs.length} proofs · {details.unit} · {details.mint}</p>
    </div></div>
    {durationMs !== undefined && <p className="field-note" aria-label="Transfer duration">First valid frame to completion: <strong>{(durationMs / 1000).toFixed(3)} s</strong></p>}
    {durationMs !== undefined && <p className="field-note" aria-label="Transfer throughput">Average payload rate: <strong>{throughput === undefined ? 'N/A' : `≈ ${throughput.toFixed(2)} kB/s`}</strong> <span>(1 kB = 1,000 bytes)</span></p>}
    <textarea aria-label="Decoded Cashu token" readOnly value={token} rows={3} spellCheck={false} />
    <div className="result-actions"><button className="button secondary small" onClick={copy}>Copy token</button>
      <span role="status">{copyStatus}</span></div>
  </section>;
}

function Sender({ token, setToken }: { token: string; setToken: (value: string) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const encoder = useRef<FountainEncoder | null>(null);
  const localReader = useRef<AutoDecoder | null>(null);
  const original = useRef<string>('');
  const [encodingMode, setEncodingMode] = useState<EncoderMode>('binary');
  const [playing, setPlaying] = useState(false);
  const [fragmentSize, setFragmentSize] = useState(128);
  const [fps, setFps] = useState(5);
  const [sequence, setSequence] = useState(0);
  const [qrInfo, setQrInfo] = useState<{ version: number; modules: number }>();
  const [info, setInfo] = useState({ bytes: 0, count: 0, urCount: 0 });
  const [error, setError] = useState('');
  const [decoded, setDecoded] = useState('');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    setPlaying(false); encoder.current = null; localReader.current = null;
    setSequence(0); setQrInfo(undefined); setInfo({ bytes: 0, count: 0, urCount: 0 }); setDecoded(''); setError(''); setChecking(false);
  }, [token, fragmentSize, encodingMode]);

  const next = useCallback(() => {
    if (!encoder.current || !canvas.current) return;
    try {
      const qr = drawFrame(canvas.current, encoder.current.nextFrame());
      setQrInfo(previous => previous?.version === qr.version ? previous : qr);
      setSequence(value => value + 1);
      if (localReader.current) {
        const scanned = readCanvas(canvas.current);
        if (scanned) localReader.current.receive(scanned);
        if (localReader.current.isComplete) {
          const result = localReader.current.result!;
          if (bytesToTokenString(result) !== original.current) {
            throw new Error('The reconstructed token did not match the input.');
          }
          setDecoded(bytesToTokenString(result)); setPlaying(false); setChecking(false);
          localReader.current = null;
        }
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not render this transfer.');
      setPlaying(false); setChecking(false);
    }
  }, []);

  const prepare = (local: boolean, autoplay = true) => {
    try {
      const bytes = tokenToBytes(token.trim());
      encoder.current = new FountainEncoder(bytes, {
        fragmentSize, mode: encodingMode, urFragmentSize: Math.min(fragmentSize, 1536),
        urPayload: new TextEncoder().encode(token.trim()),
      });
      original.current = bytesToTokenString(bytes);
      localReader.current = local ? new AutoDecoder({ allowMixedFormats: true }) : null;
      setInfo({ bytes: bytes.length, count: encoder.current.fragmentCount, urCount: encoder.current.urFragmentCount ?? 0 });
      setSequence(0); setDecoded(''); setError(''); setChecking(local); setPlaying(autoplay);
      next();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Enter a valid cashuB token.');
      setPlaying(false); setChecking(false);
    }
  };
  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(next, 1000 / fps);
    const hide = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener('visibilitychange', hide);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', hide); };
  }, [playing, fps, next]);

  const toggle = () => {
    if (playing) setPlaying(false);
    else if (encoder.current) setPlaying(true);
    else prepare(false);
  };
  return <>
    <div className="workspace">
      <section className="panel controls">
        <div className="section-heading"><span className="step">01</span><h2>Choose a token</h2>
          <button className="text-button" disabled={playing} onClick={() => setToken(demo)}>Load demo ↗</button></div>
        <label htmlFor="token">Cashu V4 token</label>
        <textarea id="token" value={token} onChange={event => setToken(event.target.value)} rows={4}
          placeholder="Paste a cashuB token…" spellCheck={false} autoCapitalize="off" autoCorrect="off" disabled={playing} />
        <p className="field-note">{token === demo ? 'Synthetic demo · 12 proofs · not spendable' : 'Your token stays in this browser. Nothing is uploaded or saved.'}</p>
        <div className="divider" />
        <div className="section-heading"><span className="step">02</span><h2>Set the pace</h2></div>
        <label htmlFor="encoding-mode">Encoding mode</label>
        <select id="encoding-mode" disabled={playing} value={encodingMode}
          onChange={event => setEncodingMode(event.target.value as EncoderMode)}>
          <option value="binary">NF only</option>
          <option value="compatibility">Compatibility · NF + UR alternating</option>
          <option value="ur">UR only · legacy wallets</option>
        </select>
        <p className="field-note">{encodingMode === 'compatibility'
          ? 'Odd display frames carry NF, even frames carry UR. Each format gets half the frame rate. Older wallets must ignore NF frames.'
          : encodingMode === 'ur' ? 'UR carries the cashuB token as text for legacy wallet testing.' : 'Send the new binary fountain format.'}</p>
        <div className="field-grid">
          <div><label htmlFor="fragment">Bytes per fragment</label><select id="fragment" disabled={playing} value={fragmentSize}
            onChange={event => setFragmentSize(Number(event.target.value))}>
            <option value={80}>80 · easier to scan</option><option value={128}>128 · balanced</option><option value={180}>180 · denser QR</option>
            {[256, 384, 512, 768, 1024, 1536, 2048].map(size => <option key={size} value={size}>{size} · density test</option>)}
            <option value={2307}>2307 · QR maximum</option>
          </select></div>
          <div><label htmlFor="fps">Frame rate <strong>{fps} fps</strong></label>
            <input id="fps" type="range" min="2" max="60" value={fps} onChange={event => setFps(Number(event.target.value))} />
            <div className="range-labels"><span>Slower</span><span>Faster</span></div></div>
        </div>
        <p className="field-note">Larger fragments put more data in each QR. NF fragments larger than the token are padded, so you can still test the full density.</p>
        {encodingMode !== 'binary' && <p className="field-note">UR fragments use up to {Math.min(fragmentSize, 1536)} bytes before text encoding, keeping them within QR capacity.</p>}
        <div className="actions"><button className="button secondary" disabled={playing} onClick={() => encoder.current ? next() : prepare(false, false)}>Next frame →</button></div>
        <button className="local-test" disabled={playing} onClick={() => prepare(true)}>↻ Run local QR test <span>No second device needed</span></button>
        {error && <p className="message error" role="alert">{error}</p>}
      </section>
      <section className="panel transmission" aria-label="QR transmitter">
        <div className="transmission-heading"><span className={'badge ' + (playing ? 'live' : '')}>
          <i />{checking && playing ? 'Checking locally' : playing ? 'Sending' : sequence ? 'Paused' : 'Ready to send'}</span><span className="micro">{encodingMode === 'compatibility' ? 'NF + UR' : encodingMode === 'ur' ? 'UR QR' : 'BINARY QR'}</span></div>
        <div className="qr-stage">
          <canvas ref={canvas} hidden={!sequence} aria-label="Fountain QR code" role="img" />
          {!sequence && <div className="qr-placeholder"><div className="qr-mark">▦</div><h3>Your transfer starts here</h3><p>Start sending to display<br />animated QR frames.</p></div>}
        </div>
        {qrInfo && <p className="field-note" aria-label="QR density">QR v{qrInfo.version} · {qrInfo.modules} × {qrInfo.modules} modules · error correction M</p>}
        <p className="scan-hint">Open <strong>Receive</strong> on your other device<br />and point its camera at this code.</p>
        <button className="button primary playback" onClick={toggle}>
          {playing ? 'Ⅱ Pause' : sequence ? '▶ Resume sending' : '▶ Start sending'}</button>
        <div className="stats"><div><strong>{sequence || '—'}</strong><span>Frames sent</span></div>
          <div><strong>{info.count || '—'}{encodingMode === 'compatibility' && info.urCount ? ` / ${info.urCount}` : ''}</strong><span>{encodingMode === 'compatibility' ? 'NF / UR fragments' : 'Source fragments'}</span></div>
          <div><strong>{info.bytes ? info.bytes.toLocaleString() : '—'}</strong><span>Token bytes</span></div></div>
      </section>
    </div>
    {decoded && <TokenResult token={decoded} local />}
    <div className="tip"><span>↳</span><p>A few missed frames are fine. Keep sending until the other device has reconstructed the token. Try a slower frame rate if scanning is difficult.</p></div>
  </>;
}

function Receiver() {
  const reader = useRef(new AutoDecoder({ allowMixedFormats: true }));
  const timing = useRef(new TransferTiming());
  const [transferDurationMs, setTransferDurationMs] = useState<number>();
  const importSession = useRef(0);
  const [reads, setReads] = useState(0);
  const [progress, setProgress] = useState({ value: 0, useful: 0, total: undefined as number | undefined });
  const [decoded, setDecoded] = useState('');
  const [issue, setIssue] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => () => { importSession.current++; }, []);
  const accept = (bytes: Uint8Array): FrameOutcome => {
    const receivedAt = performance.now();
    const before = reader.current.totalIndependentFrames;
    let accepted = false;
    let decoderError = false;
    let tokenValid: boolean | undefined;
    setReads(value => value + 1);
    try {
      accepted = reader.current.receive(bytes);
      setIssue('');
      if (reader.current.isComplete) {
        setDecoded(bytesToTokenString(reader.current.result!)); tokenValid = true;
      }
    } catch (failure) {
      decoderError = true;
      if (reader.current.isComplete) {
        tokenValid = false;
        setIssue('The transfer completed, but its bytes are not a supported Cashu token. Reset to try again.');
      } else if (failure instanceof Error && failure.message.includes('another message')) {
        setIssue('This is a different transfer. Reset the reader to receive it.');
      }
    }
    // A failed UR reconstruction clears its internal transfer; its timer must reset too.
    if (reader.current.fragmentCount === undefined) timing.current.reset();
    else timing.current.record(receivedAt, performance.now(), accepted, reader.current.isComplete);
    setTransferDurationMs(timing.current.durationMs);
    setProgress({ value: reader.current.progress, useful: reader.current.independentFrames, total: reader.current.fragmentCount });
    return { complete: reader.current.isComplete, useful: Math.max(0, reader.current.totalIndependentFrames - before),
      rank: reader.current.independentFrames, fragmentCount: reader.current.fragmentCount,
      format: reader.current.format, decoderError, tokenValid, firstValidFrameToCompleteMs: timing.current.durationMs, payloadBytes: reader.current.result?.byteLength };
  };
  const camera = useCamera(accept);
  const reset = () => {
    camera.stop(); camera.clearReport(); importSession.current++; setLoading(false);
    reader.current.reset(); timing.current.reset(); setTransferDurationMs(undefined); setReads(0); setProgress({ value: 0, useful: 0, total: undefined }); setDecoded(''); setIssue('');
  };
  const importImages = async (files: File[]) => {
    camera.stop(); const session = ++importSession.current;
    setLoading(true); setIssue('');
    try {
      let found = false;
      for (const file of files) {
        const bytes = await readQrImage(file);
        if (session !== importSession.current) return;
        if (bytes) { found = true; if (accept(bytes).complete) break; }
      }
      if (!found) setIssue('No QR code was found in these images. Use clear screenshots of the sender’s QR code.');
    } catch {
      if (session === importSession.current) setIssue('Could not read that image. Try a PNG or JPEG screenshot.');
    } finally { if (session === importSession.current) setLoading(false); }
  };
  const running = camera.phase !== 'idle';
  const percent = Math.floor(progress.value * 100);
  return <>
    <div className="workspace receive-layout">
      <section className="panel camera-panel">
        <div className="transmission-heading"><span className={'badge ' + (camera.phase === 'active' ? 'live' : '')}><i />
          {decoded ? 'Transfer complete' : camera.phase === 'active' ? 'Scanning' : camera.phase === 'requesting' ? 'Waiting for camera' : 'Ready to receive'}</span><span className="micro">CAMERA READER</span></div>
        <div className={'camera-stage ' + (camera.phase === 'active' ? 'active' : '')}>
          <video ref={camera.video} muted playsInline aria-label="Camera preview" />
          <div className="viewfinder" />
          {camera.phase !== 'active' && <div className="camera-placeholder"><span>⌖</span><h3>{decoded ? 'All frames came together.' : 'Bring the other screen into view.'}</h3><p>{decoded ? 'Your reconstructed token is below.' : 'The rear camera is used when available.'}</p></div>}
        </div>
        <div className="decoding-progress">
          <div><span>Decoding progress{reader.current.format ? ` · ${reader.current.format === 'ur' ? 'UR' : 'Binary'}` : ''}</span><strong>{percent}%</strong></div>
          <progress aria-label="Decoding progress" value={progress.value} max={1}
            aria-valuetext={`${percent}%${progress.total === undefined ? ', waiting for first frame' : `, ${progress.useful} of ${progress.total} independent frames`}`} />
          <p className="field-note">{progress.total === undefined ? 'Waiting for the first valid frame.'
            : `${progress.useful} of ${progress.total} independent frames collected.`} Progress measures information collected, not time remaining.</p>
        </div>
        <div className="camera-choice">
          <label htmlFor="camera-choice">Camera</label>
          <select id="camera-choice" value={camera.selectedCamera} disabled={camera.phase === 'requesting' || loading}
            onChange={event => camera.selectCamera(event.target.value)}>
            <option value="">Automatic rear camera</option>
            {camera.selectedCamera && !camera.cameras.some(device => device.deviceId === camera.selectedCamera) &&
              <option value={camera.selectedCamera}>Previously selected camera (unavailable)</option>}
            {camera.cameras.map(device => <option key={device.deviceId} value={device.deviceId}>{device.label}</option>)}
          </select>
          <p className="field-note">{camera.cameras.length
            ? 'Choose an individual camera to avoid lens switching. Combined Dual or Triple cameras may still switch lenses. Changing cameras keeps your decoding progress.'
            : 'Start the camera to list the lenses your browser exposes.'}</p>
        </div>
        <div className="camera-actions"><button className="button primary" disabled={Boolean(decoded) || loading}
          onClick={() => running ? camera.stop() : void camera.start()}>{camera.phase === 'requesting' ? 'Cancel camera request' : running ? 'Stop camera' : 'Start camera'}</button>
          <button className="button secondary" onClick={reset}>Reset reader</button></div>
      </section>
      <section className="panel receive-info">
        <div className="section-heading"><span className="step">01</span><h2>Collect the frames</h2></div>
        <p className="body-copy">Scan a binary transfer from this demo or a wallet’s animated UR token. Hold steady and keep the whole code in view.</p>
        <div className="receive-stats"><div><strong>{reads}</strong><span>QR reads</span></div><div><strong>{progress.useful}</strong><span>Useful frames</span></div></div>
        <p className="field-note">Repeated frames are normal. Decoding finishes when enough useful frames arrive.</p>
        <div className="divider" />
        <label className={'image-import ' + (loading || decoded ? 'disabled' : '')}>↥ {loading ? 'Reading QR images…' : 'Import QR images'}
          <input type="file" aria-label="Import QR images" accept="image/png,image/jpeg,image/webp" multiple disabled={loading || Boolean(decoded)}
            onChange={event => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ''; if (files.length) void importImages(files); }} /></label>
        <p className="field-note">A camera-free alternative: select screenshots from a paused sender, one or more at a time.</p>
        {!window.isSecureContext && <p className="message">Use HTTPS to enable the camera on a phone. Image import works here too.</p>}
        {(camera.error || issue) && <p className="message error" role="alert">{issue || camera.error}</p>}
        <div className="receive-status" role="status">{decoded ? '✓ Token reconstructed' : loading ? 'Reading frames…' : progress.useful ? 'Collecting frames… keep scanning.' : 'Waiting for your first frame.'}</div>
      </section>
    </div>
    {decoded && <TokenResult token={decoded} durationMs={transferDurationMs} payloadBytes={reader.current.result?.byteLength} />}
    {camera.report && <ScanReport key={camera.report.startedAt} report={camera.report} />}
    <div className="tip"><span>↳</span><p>The reader automatically recognizes nut-fountain binary frames and ur:bytes containing cashuB text or a binary Cashu V4 token. Compatibility mode sends both formats; the reader keeps separate progress and uses the first completed reconstruction.</p></div>
  </>;
}

export function App() {
  const [mode, setMode] = useState<'send' | 'receive'>('send');
  const [token, setToken] = useState(demo);
  return <div className="app-shell">
    <header className="site-header"><a className="brand" href="./"><span className="brand-icon">n<span>↗</span></span>nut-fountain</a><span className="experiment">EXPERIMENTAL</span></header>
    <main>
      <div className="intro"><div><p className="eyebrow">CASHU / BINARY TRANSPORT</p><h1>From screen to screen.</h1><p className="subtitle">A small playground for moving tokens through animated QR codes.</p></div><div className="local-badge"><i /> Runs in your browser</div></div>
      <nav className="mode-switch" aria-label="Transfer mode"><button aria-pressed={mode === 'send'} onClick={() => setMode('send')}>↗ Send</button><button aria-pressed={mode === 'receive'} onClick={() => setMode('receive')}>↙ Receive</button></nav>
      {mode === 'send' ? <Sender token={token} setToken={setToken} /> : <Receiver />}
    </main>
    <footer><span>nut-fountain <span className="footer-separator">/</span> device playground</span><span>Local processing. No mint connection.</span></footer>
  </div>;
}
