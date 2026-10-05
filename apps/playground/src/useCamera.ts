import { useCallback, useEffect, useRef, useState } from 'react';
import { readCanvas } from './qr';

type CameraPhase = 'idle' | 'requesting' | 'active';

export function useCamera(onFrame: (bytes: Uint8Array) => boolean) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const generation = useRef(0);
  const callback = useRef(onFrame);
  callback.current = onFrame;
  const [phase, setPhase] = useState<CameraPhase>('idle');
  const [error, setError] = useState('');

  const release = useCallback(() => {
    generation.current++;
    clearTimeout(timer.current);
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  }, []);
  const stop = useCallback(() => { release(); setPhase('idle'); }, [release]);

  useEffect(() => {
    const hide = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', hide);
    return () => { document.removeEventListener('visibilitychange', hide); release(); };
  }, [release, stop]);

  const start = async () => {
    stop();
    setError('');
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError('Camera access needs HTTPS on a phone, or localhost on this device. You can also import QR images below.');
      return;
    }
    const session = generation.current;
    setPhase('requesting');
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (session !== generation.current || !video.current) {
        media.getTracks().forEach(track => track.stop());
        return;
      }
      stream.current = media;
      video.current.srcObject = media;
      await video.current.play();
      if (session !== generation.current) return;
      setPhase('active');
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true })!;
      const scan = () => {
        if (session !== generation.current) return;
        try {
          const element = video.current;
          if (element && element.readyState >= 2 && element.videoWidth > 0 && element.videoHeight > 0) {
            const scale = Math.min(1, 720 / Math.max(element.videoWidth, element.videoHeight));
            canvas.width = Math.round(element.videoWidth * scale);
            canvas.height = Math.round(element.videoHeight * scale);
            context.drawImage(element, 0, 0, canvas.width, canvas.height);
            const bytes = readCanvas(canvas);
            if (bytes && callback.current(bytes)) { stop(); return; }
          }
          timer.current = setTimeout(scan, 100);
        } catch {
          stop();
          setError('Could not read the camera image. Restart the camera or try importing QR images.');
        }
      };
      scan();
    } catch (failure) {
      if (session !== generation.current) return;
      stop();
      const name = failure instanceof DOMException ? failure.name : '';
      setError(name === 'NotAllowedError'
        ? 'Camera access was denied. Allow camera access in your browser and try again.'
        : name === 'NotFoundError' ? 'No camera was found. Try importing QR images instead.'
          : 'Could not start the camera. Close other camera apps and try again.');
    }
  };
  return { video, phase, error, start, stop };
}
