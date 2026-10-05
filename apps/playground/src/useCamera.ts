import { useCallback, useEffect, useRef, useState } from 'react';
import { ScanDiagnostics, type FrameOutcome, type ScanReport } from './scanDiagnostics';
import type { QrJob, QrReply } from './qr.worker';

type CameraPhase = 'idle' | 'requesting' | 'active';

export function useCamera(onFrame: (bytes: Uint8Array) => FrameOutcome) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const worker = useRef<Worker | null>(null);
  const cancelScheduled = useRef<(() => void) | undefined>(undefined);
  const generation = useRef(0);
  const callback = useRef(onFrame);
  callback.current = onFrame;
  const active = useRef<{ metrics: ScanDiagnostics; since: number } | undefined>(undefined);
  const [cameras, setCameras] = useState<{ deviceId: string; label: string }[]>([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [phase, setPhase] = useState<CameraPhase>('idle');
  const [error, setError] = useState('');
  const [report, setReport] = useState<ScanReport>();

  const release = useCallback(() => {
    generation.current++;
    cancelScheduled.current?.(); cancelScheduled.current = undefined;
    worker.current?.terminate(); worker.current = null;
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
    if (video.current) video.current.srcObject = null;
    active.current = undefined;
  }, []);
  const finish = useCallback((reason: 'complete' | 'stopped' | 'error') => {
    if (active.current) setReport(active.current.metrics.finish(performance.now() - active.current.since, reason));
    release(); setPhase('idle');
  }, [release]);
  const stop = useCallback(() => finish('stopped'), [finish]);
  const clearReport = useCallback(() => setReport(undefined), []);

  useEffect(() => {
    const hide = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', hide);
    return () => { document.removeEventListener('visibilitychange', hide); release(); };
  }, [release, stop]);

  const start = async (deviceId = selectedCamera) => {
    stop(); setReport(undefined); setError('');
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError('Camera access needs HTTPS on a phone, or localhost on this device. You can also import QR images below.');
      return;
    }
    const session = generation.current;
    const requestedAt = performance.now();
    setPhase('requesting');
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' } }), width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 60 } },
        audio: false,
      });
      if (session !== generation.current || !video.current) {
        media.getTracks().forEach(track => track.stop()); return;
      }
      stream.current = media;
      // Device labels become available after permission. Discovery is optional:
      // its failure must not interrupt capture or let stale sessions update UI.
      void navigator.mediaDevices.enumerateDevices?.().then(devices => {
        if (session !== generation.current) return;
        setCameras(devices.filter(device => device.kind === 'videoinput' && device.deviceId)
          .map((device, index) => ({ deviceId: device.deviceId, label: device.label || `Camera ${index + 1}` })));
      }).catch(() => {});
      const element = video.current;
      element.srcObject = media;
      await element.play();
      if (session !== generation.current) return;
      const useVideoCallback = typeof element.requestVideoFrameCallback === 'function';
      const { width, height, frameRate, facingMode } = media.getVideoTracks()[0]?.getSettings() ?? {};
      const since = performance.now();
      const metrics = new ScanDiagnostics({
        userAgent: navigator.userAgent, hardwareConcurrency: navigator.hardwareConcurrency,
        viewport: { width: innerWidth, height: innerHeight, pixelRatio: devicePixelRatio },
        camera: { width, height, frameRate, facingMode, selection: deviceId ? 'explicit-device' : 'automatic' },
        scheduler: useVideoCallback ? 'video-frame-callback' : 'animation-frame',
        buildTime: import.meta.env.VITE_BUILD_TIME ?? 'development',
      }, new Date().toISOString(), since - requestedAt);
      active.current = { metrics, since };
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Canvas unavailable');
      const qrWorker = new Worker(new URL('./qr.worker.ts', import.meta.url), { type: 'module' });
      worker.current = qrWorker;
      let pending: { started: number; sent: number; captureMs: number } | undefined;
      let lastFrame: number | undefined;
      const fail = () => {
        if (session !== generation.current) return;
        finish('error'); setError('Could not read the camera image. Restart the camera or try importing QR images.');
      };
      qrWorker.onerror = event => { event.preventDefault(); fail(); };
      qrWorker.onmessageerror = fail;
      qrWorker.onmessage = ({ data }: MessageEvent<QrReply>) => {
        if (session !== generation.current || !pending) return;
        const job = pending; pending = undefined;
        if (data.failed) { fail(); return; }
        try {
          const arrived = performance.now();
          const outcome = data.bytes ? callback.current(data.bytes) : undefined;
          const ended = performance.now();
          metrics.record({ atMs: ended - since, captureMs: job.captureMs, qrDecodeMs: data.decodeMs,
            workerRoundTripMs: arrived - job.sent, receiveMs: ended - arrived,
            totalMs: ended - job.started, found: Boolean(data.bytes), outcome });
          if (outcome?.complete) finish('complete');
        } catch { fail(); }
      };
      const schedule = () => {
        if (useVideoCallback) {
          const id = element.requestVideoFrameCallback((_now, metadata) => scan(metadata));
          cancelScheduled.current = () => element.cancelVideoFrameCallback(id);
        } else {
          const id = requestAnimationFrame(() => scan());
          cancelScheduled.current = () => cancelAnimationFrame(id);
        }
      };
      const scan = (metadata?: VideoFrameCallbackMetadata) => {
        if (session !== generation.current) return;
        // Keep observing fresh frames while busy; never queue old images behind the worker.
        schedule(); metrics.callbacks++;
        if (metadata) metrics.presented(metadata.presentedFrames);
        if (pending) { metrics.busySkipped++; return; }
        if (element.readyState < 2 || !element.videoWidth || !element.videoHeight) return;
        // Live iPhone streams can repeat mediaTime while their images advance.
        // presentedFrames identifies compositor frames; mediaTime is not a frame ID.
        const frame = metadata?.presentedFrames
          ?? (element.getVideoPlaybackQuality?.().totalVideoFrames || element.currentTime);
        if (frame === lastFrame) { metrics.repeatedVideoFrames++; return; }
        lastFrame = frame;
        try {
          const started = performance.now();
          const scale = Math.min(1, 720 / Math.max(element.videoWidth, element.videoHeight));
          const w = Math.round(element.videoWidth * scale), h = Math.round(element.videoHeight * scale);
          if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
          context.drawImage(element, 0, 0, w, h);
          const pixels = context.getImageData(0, 0, w, h);
          const sent = performance.now();
          pending = { started, sent, captureMs: sent - started };
          metrics.captured(w, h);
          const job: QrJob = { pixels: pixels.data, width: w, height: h };
          qrWorker.postMessage(job, [pixels.data.buffer]);
        } catch { fail(); }
      };
      setPhase('active'); schedule();
    } catch (failure) {
      if (session !== generation.current) return;
      finish('error');
      const name = failure instanceof DOMException ? failure.name : '';
      setError(name === 'NotAllowedError'
        ? 'Camera access was denied. Allow camera access in your browser and try again.'
        : deviceId && (name === 'NotFoundError' || name === 'OverconstrainedError')
          ? 'The selected camera is unavailable. Choose another camera or Automatic rear camera and try again.'
          : name === 'NotFoundError' ? 'No camera was found. Try importing QR images instead.'
          : 'Could not start the camera. Close other camera apps and try again.');
    }
  };
  const selectCamera = (deviceId: string) => {
    setSelectedCamera(deviceId); setError('');
    if (phase === 'active') void start(deviceId);
  };
  return { video, phase, error, report, clearReport, start, stop, cameras, selectedCamera, selectCamera };
}
