import { useCallback, useEffect, useRef, useState } from 'react';
import { FountainDecoder, FountainEncoder } from 'nut-fountain/core';
import { bytesToToken, bytesToTokenString, tokenToBytes } from 'nut-fountain/cashu';
import { drawFrame, readCanvas, readQrImage } from './qr';
import { makeDemoToken } from './demo';
import { useCamera } from './useCamera';

const demo = makeDemoToken();

function TokenResult({ token, local = false }: { token: string; local?: boolean }) {
  const [copyStatus, setCopyStatus] = useState('');
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
    <textarea aria-label="Decoded Cashu token" readOnly value={token} rows={3} spellCheck={false} />
    <div className="result-actions"><button className="button secondary small" onClick={copy}>Copy token</button>
      <span role="status">{copyStatus}</span></div>
  </section>;
}

function Sender({ token, setToken }: { token: string; setToken: (value: string) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const encoder = useRef<FountainEncoder | null>(null);
  const localReader = useRef<FountainDecoder | null>(null);
  const original = useRef<Uint8Array | null>(null);
  const [playing, setPlaying] = useState(false);
  const [fragmentSize, setFragmentSize] = useState(128);
  const [fps, setFps] = useState(5);
  const [sequence, setSequence] = useState(0);
  const [info, setInfo] = useState({ bytes: 0, count: 0 });
  const [error, setError] = useState('');
  const [decoded, setDecoded] = useState('');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    setPlaying(false); encoder.current = null; localReader.current = null;
    setSequence(0); setInfo({ bytes: 0, count: 0 }); setDecoded(''); setError(''); setChecking(false);
  }, [token, fragmentSize]);

  const next = useCallback(() => {
    if (!encoder.current || !canvas.current) return;
    try {
      drawFrame(canvas.current, encoder.current.nextFrame());
      setSequence(value => value + 1);
      if (localReader.current) {
        const scanned = readCanvas(canvas.current);
        if (scanned) localReader.current.receive(scanned);
        if (localReader.current.isComplete) {
          const result = localReader.current.result!;
          if (result.length !== original.current?.length || !result.every((byte, i) => byte === original.current![i])) {
            throw new Error('The reconstructed bytes did not match the input.');
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
      encoder.current = new FountainEncoder(bytes, { fragmentSize });
      original.current = bytes;
      localReader.current = local ? new FountainDecoder() : null;
      setInfo({ bytes: bytes.length, count: encoder.current.fragmentCount });
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
        <div className="field-grid">
          <div><label htmlFor="fragment">Bytes per fragment</label><select id="fragment" disabled={playing} value={fragmentSize}
            onChange={event => setFragmentSize(Number(event.target.value))}>
            <option value={80}>80 · easier to scan</option><option value={128}>128 · balanced</option><option value={180}>180 · denser QR</option>
          </select></div>
          <div><label htmlFor="fps">Frame rate <strong>{fps} fps</strong></label>
            <input id="fps" type="range" min="2" max="12" value={fps} onChange={event => setFps(Number(event.target.value))} />
            <div className="range-labels"><span>Slower</span><span>Faster</span></div></div>
        </div>
        <div className="actions"><button className="button secondary" disabled={playing} onClick={() => encoder.current ? next() : prepare(false, false)}>Next frame →</button></div>
        <button className="local-test" disabled={playing} onClick={() => prepare(true)}>↻ Run local QR test <span>No second device needed</span></button>
        {error && <p className="message error" role="alert">{error}</p>}
      </section>
      <section className="panel transmission" aria-label="QR transmitter">
        <div className="transmission-heading"><span className={'badge ' + (playing ? 'live' : '')}>
          <i />{checking && playing ? 'Checking locally' : playing ? 'Sending' : sequence ? 'Paused' : 'Ready to send'}</span><span className="micro">BINARY QR</span></div>
        <div className="qr-stage">
          <canvas ref={canvas} hidden={!sequence} aria-label="Binary fountain QR code" role="img" />
          {!sequence && <div className="qr-placeholder"><div className="qr-mark">▦</div><h3>Your transfer starts here</h3><p>Start sending to display<br />animated QR frames.</p></div>}
        </div>
        <p className="scan-hint">Open <strong>Receive</strong> on your other device<br />and point its camera at this code.</p>
        <button className="button primary playback" onClick={toggle}>
          {playing ? 'Ⅱ Pause' : sequence ? '▶ Resume sending' : '▶ Start sending'}</button>
        <div className="stats"><div><strong>{sequence || '—'}</strong><span>Frames sent</span></div>
          <div><strong>{info.count || '—'}</strong><span>Source fragments</span></div>
          <div><strong>{info.bytes ? info.bytes.toLocaleString() : '—'}</strong><span>Token bytes</span></div></div>
      </section>
    </div>
    {decoded && <TokenResult token={decoded} local />}
    <div className="tip"><span>↳</span><p>A few missed frames are fine. Keep sending until the other device has reconstructed the token. Try a slower frame rate if scanning is difficult.</p></div>
  </>;
}

function Receiver() {
  const reader = useRef(new FountainDecoder());
  const importSession = useRef(0);
  const [reads, setReads] = useState(0);
  const [progress, setProgress] = useState({ value: 0, useful: 0, total: undefined as number | undefined });
  const [decoded, setDecoded] = useState('');
  const [issue, setIssue] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => () => { importSession.current++; }, []);
  const accept = (bytes: Uint8Array): boolean => {
    if (reader.current.isComplete) return true;
    setReads(value => value + 1);
    try {
      reader.current.receive(bytes);
      setIssue('');
      if (reader.current.isComplete) { setDecoded(bytesToTokenString(reader.current.result!)); return true; }
    } catch (failure) {
      if (reader.current.isComplete) {
        setIssue('The transfer completed, but its bytes are not a supported Cashu token. Reset to try again.');
        return true;
      }
      if (failure instanceof Error && failure.message.includes('another message')) {
        setIssue('This is a different transfer. Reset the reader to receive it.');
      }
    } finally {
      setProgress({ value: reader.current.progress, useful: reader.current.independentFrames, total: reader.current.fragmentCount });
    }
    return false;
  };
  const camera = useCamera(accept);
  const reset = () => {
    camera.stop(); importSession.current++; setLoading(false);
    reader.current = new FountainDecoder(); setReads(0); setProgress({ value: 0, useful: 0, total: undefined }); setDecoded(''); setIssue('');
  };
  const importImages = async (files: File[]) => {
    camera.stop(); const session = ++importSession.current;
    setLoading(true); setIssue('');
    try {
      let found = false;
      for (const file of files) {
        const bytes = await readQrImage(file);
        if (session !== importSession.current) return;
        if (bytes) { found = true; if (accept(bytes)) break; }
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
          <div><span>Decoding progress</span><strong>{percent}%</strong></div>
          <progress aria-label="Decoding progress" value={progress.value} max={1}
            aria-valuetext={`${percent}%${progress.total === undefined ? ', waiting for first frame' : `, ${progress.useful} of ${progress.total} independent frames`}`} />
          <p className="field-note">{progress.total === undefined ? 'Waiting for the first valid frame.'
            : `${progress.useful} of ${progress.total} independent frames collected.`} Progress measures information collected, not time remaining.</p>
        </div>
        <div className="camera-actions"><button className="button primary" disabled={Boolean(decoded) || loading}
          onClick={running ? camera.stop : camera.start}>{camera.phase === 'requesting' ? 'Cancel camera request' : running ? 'Stop camera' : 'Start camera'}</button>
          <button className="button secondary" onClick={reset}>Reset reader</button></div>
      </section>
      <section className="panel receive-info">
        <div className="section-heading"><span className="step">01</span><h2>Collect the frames</h2></div>
        <p className="body-copy">Point your camera at a sending device. Hold it steady and keep the whole code in view.</p>
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
    {decoded && <TokenResult token={decoded} />}
    <div className="tip"><span>↳</span><p>This reader recognizes nut-fountain binary frames. Use the Send view on the other device; a regular wallet scanner may not understand this experimental format.</p></div>
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
