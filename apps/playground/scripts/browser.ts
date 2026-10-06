import { checkCameraSelection } from './camera-selection';
import { strict as assert } from 'node:assert';
import { resolve, sep } from 'node:path';
import { chromium, type Page } from 'playwright';
import QRCode from 'qrcode';
import { tokenToBytes } from 'nut-fountain/cashu';
import { urParts } from '../tests/ur-fixtures';

const qrImages = async (parts: string[]) => Promise.all(parts.map(async part =>
  'data:image/png;base64,' + (await QRCode.toBuffer(part, { errorCorrectionLevel: 'M', scale: 5, margin: 4 })).toString('base64')));
const imageFiles = (images: string[]) => images.map((image, i) => ({
  name: `${i}.png`, mimeType: 'image/png', buffer: Buffer.from(image.split(',')[1]!, 'base64'),
}));

const dist = resolve('dist');
const server = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(request) {
  const path = resolve(dist, '.' + decodeURIComponent(new URL(request.url).pathname));
  if (path !== dist && !path.startsWith(dist + sep)) return new Response(null, { status: 403 });
  const file = Bun.file(path === dist ? resolve(dist, 'index.html') : path);
  return await file.exists() ? new Response(file) : new Response(null, { status: 404 });
} });
const browser = await chromium.launch({ headless: true });
const failures: string[] = [];
const passed: string[] = [];
const page = await browser.newPage();
page.on('pageerror', error => failures.push(error.message));
const receive = async (target: Page) => {
  await target.goto(server.url.href);
  await target.getByRole('button', { name: '↙ Receive', exact: true }).click();
};
try {
  await page.goto(server.url.href);
  const token = await page.locator('#token').inputValue();
  await page.getByRole('button', { name: /Run local QR test/ }).click();
  await page.getByRole('heading', { name: 'Local QR round trip passed' }).waitFor({ timeout: 20000 });
  assert.equal(await page.getByLabel('Decoded Cashu token').inputValue(), token);
  passed.push('Token → rendered binary QR pixels → token');

  for (const mode of ['compatibility', 'ur']) {
    await page.locator('#encoding-mode').selectOption(mode);
    await page.getByRole('button', { name: /Run local QR test/ }).click();
    await page.getByRole('heading', { name: 'Local QR round trip passed' }).waitFor({ timeout: 30000 });
    assert.equal(await page.getByLabel('Decoded Cashu token').inputValue(), token);
    passed.push(`${mode} sender completes a local QR round trip`);
  }
  await page.locator('#encoding-mode').selectOption('binary');

  // Capture the actual alternating sender. Start importing on UR to exercise
  // joining at either parity, then verify legacy readers' UR-only view as well.
  await page.locator('#encoding-mode').selectOption('compatibility');
  const mixedFrames: string[] = [];
  for (let i = 0; i < 48; i++) {
    await page.getByRole('button', { name: /Next frame/ }).click();
    mixedFrames.push(await page.locator('canvas').evaluate(canvas => (canvas as HTMLCanvasElement).toDataURL('image/png')));
  }
  for (const images of [mixedFrames.slice(1), mixedFrames.filter((_, i) => i % 2 === 1)]) {
    await receive(page);
    await page.getByLabel('Import QR images').setInputFiles(imageFiles(images));
    await page.getByRole('heading', { name: 'Token received' }).waitFor();
    assert.equal(await page.getByLabel('Decoded Cashu token').inputValue(), token);
    assert.equal(await page.getByRole('alert').count(), 0);
  }
  passed.push('Actual alternating sender images decode from UR-first mixed input and UR-only input');
  await page.goto(server.url.href);

  await page.locator('#token').fill('cashuAinvalid');
  await page.getByRole('button', { name: /Start sending/ }).click();
  await page.getByRole('alert').waitFor();
  assert.equal(await page.getByRole('button', { name: /Pause/ }).count(), 0);
  passed.push('Invalid token produces an error without starting playback');

  await page.reload();
  await page.getByRole('button', { name: /Next frame/ }).click();
  const count = Number(await page.locator('.stats > div').nth(1).locator('strong').textContent());
  const frames: string[] = [];
  // Discard all systematic frames: image and camera tests exercise repair decoding.
  for (let i = 0; i < count * 4; i++) {
    await page.getByRole('button', { name: /Next frame/ }).click();
    if (i >= count && i % 3 !== 0) {
      frames.push(await page.locator('canvas').evaluate(canvas => (canvas as HTMLCanvasElement).toDataURL('image/png')));
    }
  }
  await receive(page);
  const bar = page.getByRole('progressbar', { name: 'Decoding progress' });
  const value = () => bar.evaluate(element => (element as HTMLProgressElement).value);
  assert.equal(await value(), 0);
  const firstImage = { name: 'first.png', mimeType: 'image/png', buffer: Buffer.from(frames[0]!.split(',')[1]!, 'base64') };
  await page.getByLabel('Import QR images').setInputFiles([firstImage]);
  await page.waitForFunction(expected => document.querySelector('progress')?.value === expected, 1 / count);
  assert.equal(await value(), 1 / count);
  await page.getByLabel('Import QR images').setInputFiles([firstImage]);
  await page.waitForFunction(() => document.querySelector('.receive-stats strong')?.textContent === '2');
  assert.equal(await value(), 1 / count);
  await page.getByLabel('Import QR images').setInputFiles(frames.map((frame, i) => ({
    name: `${i}.png`, mimeType: 'image/png', buffer: Buffer.from(frame.split(',')[1]!, 'base64'),
  })));
  await page.getByRole('heading', { name: 'Token received' }).waitFor();
  assert.equal(await page.getByLabel('Decoded Cashu token').inputValue(), token);
  assert.equal(await value(), 1);
  await page.getByRole('button', { name: 'Reset reader' }).click();
  assert.equal(await value(), 0);
  passed.push('Progress reflects partial repair input, ignores duplicates, reaches 100% and resets');
  passed.push('Imported QR images reconstruct from repair frames with loss');

  for (const binary of [false, true]) for (const multipart of [false, true]) {
    await receive(page);
    const payload = binary ? tokenToBytes(token) : new TextEncoder().encode(token);
    const parts = urParts(payload, multipart ? 100 : 4096);
    const images = await qrImages(parts.map((part, i) => i % 2 ? part : part.toUpperCase()));
    await page.getByLabel('Import QR images').setInputFiles(imageFiles(images.slice(0, 1)));
    if (multipart) {
      await page.waitForFunction(expected => document.querySelector('progress')?.value === expected, 1 / parts.length);
      await page.getByLabel('Import QR images').setInputFiles(imageFiles(images));
    }
    await page.getByRole('heading', { name: 'Token received' }).waitFor();
    assert.equal(await page.getByLabel('Decoded Cashu token').inputValue(), token);
    assert.equal(await value(), 1);
    await page.getByLabel('Transfer duration').waitFor();
    await page.getByLabel('Transfer throughput').waitFor();
    passed.push(`${multipart ? 'Multipart' : 'Single-part'} UR ${binary ? 'binary token' : 'cashuB string'} images auto-detect and decode`);
  }
  const urFrames = await qrImages(urParts(new TextEncoder().encode(token), 100, true).map(part => part.toUpperCase()));

  const camera = await browser.newPage();
  camera.on('pageerror', error => failures.push(error.message));
  await camera.addInitScript(({ frames }) => {
    const state = { stops: 0, workers: 0, delay: 0, deny: false, blank: false, failWorker: false, freezeMediaTime: true, initialBlankMs: 1000, drawMs: 180, captureFps: 30, frames };
    Object.assign(window, { cameraTest: state });
    // Live iPhone camera metadata can keep mediaTime unchanged even though
    // presentedFrames advances. A blank first image must not freeze the reader.
    const requestFrame = HTMLVideoElement.prototype.requestVideoFrameCallback;
    HTMLVideoElement.prototype.requestVideoFrameCallback = function(callback) {
      return requestFrame.call(this, (now, metadata) => callback(now,
        state.freezeMediaTime ? { ...metadata, mediaTime: 0 } : metadata));
    };
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      private ended = false;
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options); state.workers++;
        if (state.failWorker) setTimeout(() => this.dispatchEvent(new ErrorEvent('error', { cancelable: true })), 10);
      }
      terminate() { if (!this.ended) { this.ended = true; state.workers--; } super.terminate(); }
    };
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => {
      if (state.deny) throw new DOMException('Denied', 'NotAllowedError');
      const images = await Promise.all(state.frames.map(async src => {
        const image = new Image(); image.src = src; await image.decode(); return image;
      }));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(...images.map(image => image.width)); canvas.height = Math.max(...images.map(image => image.height));
      const context = canvas.getContext('2d')!;
      let index = 0;
      const started = performance.now();
      const draw = () => {
        context.fillStyle = 'white'; context.fillRect(0, 0, canvas.width, canvas.height);
        if (!state.blank && performance.now() - started >= state.initialBlankMs) context.drawImage(images[index++ % images.length]!, 0, 0);
      };
      draw();
      const interval = setInterval(draw, state.drawMs);
      const stream = canvas.captureStream(state.captureFps);
      for (const track of stream.getTracks()) {
        const stop = track.stop.bind(track);
        track.stop = () => { state.stops++; clearInterval(interval); stop(); };
      }
      if (state.delay) await new Promise(resolve => setTimeout(resolve, state.delay));
      return stream;
    } });
  }, { frames });
  await receive(camera);
  await camera.getByRole('button', { name: 'Start camera', exact: true }).click();
  await camera.getByRole('heading', { name: 'Token received' }).waitFor({ timeout: 25000 });
  assert.equal(await camera.getByLabel('Decoded Cashu token').inputValue(), token);
  await camera.waitForFunction(() => (window as any).cameraTest.stops === 1);
  await camera.waitForFunction(() => (window as any).cameraTest.workers === 0);
  const downloadReport = async () => {
    const [download] = await Promise.all([
      camera.waitForEvent('download'), camera.getByRole('button', { name: 'Download scan diagnostics' }).click(),
    ]);
    return JSON.parse(await Bun.file((await download.path())!).text());
  };
  await camera.getByLabel('Sender frame rate (optional)').fill('8');
  const diagnostics = await downloadReport();
  assert.equal(diagnostics.reason, 'complete');
  assert.equal(diagnostics.configuration.decoder, 'jsQR-worker');
  assert.equal(diagnostics.environment.scheduler, 'video-frame-callback');
  assert.equal(diagnostics.transfer.format, 'binary');
  assert.equal(diagnostics.transfer.tokenValid, true);
  assert.ok(diagnostics.firstValidFrameToCompleteMs > 0);
  assert.ok(diagnostics.payloadBytes > 0);
  assert.equal(diagnostics.payloadKilobytesPerSecond, diagnostics.payloadBytes / diagnostics.firstValidFrameToCompleteMs);
  assert.ok((await camera.getByLabel('Transfer throughput').textContent())?.includes(diagnostics.payloadKilobytesPerSecond.toFixed(2)));
  assert.ok(diagnostics.firstValidFrameToCompleteMs < diagnostics.activeDurationMs);
  assert.ok((await camera.getByLabel('Transfer duration').textContent())?.includes((diagnostics.firstValidFrameToCompleteMs / 1000).toFixed(3)));
  assert.equal(diagnostics.counts.usefulEquations, count);
  assert.equal(diagnostics.testConditions.senderFps, 8);
  assert.ok(diagnostics.rates.attemptsPerSecond > 0);
  assert.ok(diagnostics.timings.qrDecodeMs.count > 0);
  assert.ok(!JSON.stringify(diagnostics).includes(token));
  assert.ok(!JSON.stringify(diagnostics).includes('mint.example'));
  await Bun.write('/tmp/nut-fountain-camera-diagnostics.json', JSON.stringify(diagnostics, null, 2));
  passed.push('Moving video with constant mediaTime advances from a blank first frame, completes in the worker, and exports diagnostics');

  await camera.getByRole('button', { name: 'Reset reader' }).click();
  assert.equal(await camera.getByRole('button', { name: 'Download scan diagnostics' }).count(), 0);
  await camera.evaluate(() => Object.assign((window as any).cameraTest, { blank: true, freezeMediaTime: false, initialBlankMs: 0, drawMs: 16, captureFps: 30 }));
  await camera.getByRole('button', { name: 'Start camera', exact: true }).click();
  await camera.getByRole('button', { name: 'Stop camera', exact: true }).waitFor();
  await camera.waitForTimeout(1500);
  await camera.getByRole('button', { name: 'Stop camera', exact: true }).click();
  await camera.waitForFunction(() => (window as any).cameraTest.stops === 2 && (window as any).cameraTest.workers === 0);
  const blankReport = await downloadReport();
  assert.equal(blankReport.reason, 'stopped');
  assert.equal(blankReport.firstValidFrameToCompleteMs, undefined);
  assert.equal(blankReport.payloadKilobytesPerSecond, undefined);
  assert.equal(await camera.getByLabel('Transfer duration').count(), 0);
  assert.ok(blankReport.counts.completedAttempts > 0);
  assert.equal(blankReport.counts.qrReads, 0);
  console.log(JSON.stringify({ simulatedCameraScansPerSecond: blankReport.rates.attemptsPerSecond }));
  await camera.waitForTimeout(200);
  assert.deepEqual(await downloadReport(), blankReport);
  await camera.getByRole('button', { name: 'Start camera', exact: true }).click();
  await camera.getByRole('button', { name: 'Stop camera', exact: true }).waitFor();
  await camera.getByRole('button', { name: '↗ Send', exact: true }).click();
  await camera.waitForFunction(() => (window as any).cameraTest.stops === 3);
  passed.push('Manual stop and switching views release the camera');

  await camera.getByRole('button', { name: '↙ Receive', exact: true }).click();
  await camera.evaluate(() => { (window as any).cameraTest.delay = 500; });
  await camera.getByRole('button', { name: 'Start camera', exact: true }).click();
  await camera.getByRole('button', { name: 'Cancel camera request', exact: true }).waitFor();
  await camera.getByRole('button', { name: '↗ Send', exact: true }).click();
  await camera.waitForFunction(() => (window as any).cameraTest.stops === 4);
  passed.push('Permission resolving after unmount releases the late stream');

  await camera.getByRole('button', { name: '↙ Receive', exact: true }).click();
  await camera.evaluate(() => { (window as any).cameraTest.deny = true; });
  await camera.getByRole('button', { name: 'Start camera', exact: true }).click();
  await camera.getByRole('alert').filter({ hasText: 'Camera access was denied' }).waitFor();
  passed.push('Permission denial displays an actionable message');

  await camera.getByRole('button', { name: 'Reset reader' }).click();
  await camera.evaluate(frames => {
    Object.assign((window as any).cameraTest, { frames, deny: false, blank: false, delay: 0, drawMs: 180 });
    Object.defineProperty(HTMLVideoElement.prototype, 'requestVideoFrameCallback', { value: undefined, configurable: true });
  }, urFrames);
  await camera.getByRole('button', { name: 'Start camera', exact: true }).click();
  await camera.getByRole('heading', { name: 'Token received' }).waitFor({ timeout: 30000 });
  assert.equal(await camera.getByLabel('Decoded Cashu token').inputValue(), token);
  await camera.waitForFunction(() => (window as any).cameraTest.stops === 5);
  assert.equal(await camera.getByRole('progressbar').evaluate(element => (element as HTMLProgressElement).value), 1);
  const urReport = await downloadReport();
  assert.equal(urReport.environment.scheduler, 'animation-frame');
  assert.equal(urReport.transfer.format, 'ur');
  assert.equal(urReport.transfer.tokenValid, true);
  assert.ok(urReport.firstValidFrameToCompleteMs > 0);
  assert.ok(urReport.payloadBytes > 0);
  assert.equal(urReport.payloadKilobytesPerSecond, urReport.payloadBytes / urReport.firstValidFrameToCompleteMs);
  assert.ok((await camera.getByLabel('Transfer throughput').textContent())?.includes(urReport.payloadKilobytesPerSecond.toFixed(2)));
  assert.ok((await camera.getByLabel('Transfer duration').textContent())?.includes((urReport.firstValidFrameToCompleteMs / 1000).toFixed(3)));
  assert.ok(!JSON.stringify(urReport).includes(token));
  await camera.waitForFunction(() => (window as any).cameraTest.workers === 0);
  passed.push('Animation-frame fallback decodes UR repair frames and exports UR progress diagnostics');

  await camera.getByRole('button', { name: 'Reset reader' }).click();
  await camera.evaluate(() => { (window as any).cameraTest.failWorker = true; });
  await camera.getByRole('button', { name: 'Start camera', exact: true }).click();
  await camera.getByRole('alert').filter({ hasText: 'Could not read the camera image' }).waitFor();
  await camera.waitForFunction(() => (window as any).cameraTest.stops === 6 && (window as any).cameraTest.workers === 0);
  assert.equal((await downloadReport()).reason, 'error');
  passed.push('Worker errors stop capture, release resources, and leave an exportable diagnostic report');

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await mobile.goto(server.url.href);
  assert.equal(await mobile.locator('#fps').getAttribute('max'), '60');
  await mobile.getByRole('button', { name: /Start sending/ }).click();
  await mobile.getByRole('button', { name: /Pause/ }).click();
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await mobile.screenshot({ path: '/tmp/nut-fountain-mobile.png', fullPage: true });
  await mobile.getByRole('button', { name: '↙ Receive', exact: true }).click();
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  passed.push('390px mobile send and receive views have no horizontal overflow');
  passed.push(await checkCameraSelection(browser, server.url.href));
  assert.deepEqual(failures, []);
  console.log(JSON.stringify({ passed }, null, 2));
} finally {
  await browser.close();
  await server.stop(true);
}
