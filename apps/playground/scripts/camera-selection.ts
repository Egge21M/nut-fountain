import { strict as assert } from 'node:assert';
import type { Browser } from 'playwright';

export async function checkCameraSelection(browser: Browser, url: string) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(() => {
    const state = { requests: [] as MediaStreamConstraints[], live: 0, stops: 0, fail: false, delay: 0, enumerationFails: false };
    Object.assign(window, { selectionTest: state });
    Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', { value: async () => {
      if (state.enumerationFails) throw new Error('Enumeration unavailable');
      return ['triple', 'wide', 'ultra'].map((id, i) => ({ kind: 'videoinput', deviceId: id,
        label: ['Back Triple Camera', 'Back Camera', 'Back Ultra Wide Camera'][i], groupId: '' }));
    } });
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async (constraints: MediaStreamConstraints) => {
      state.requests.push(constraints);
      if (state.fail) throw new DOMException('Selected camera unavailable', 'OverconstrainedError');
      const deviceId = (constraints.video as MediaTrackConstraints).deviceId as { exact?: string } | undefined;
      const id = deviceId?.exact ?? 'triple';
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 100;
      const context = canvas.getContext('2d')!; context.fillStyle = 'white'; context.fillRect(0, 0, 100, 100);
      const timer = setInterval(() => context.fillRect(0, 0, 100, 100), 50);
      const stream = canvas.captureStream(20); state.live++;
      for (const track of stream.getTracks()) {
        const settings = track.getSettings.bind(track), stop = track.stop.bind(track);
        Object.defineProperty(track, 'getSettings', { value: () => ({ ...settings(), deviceId: id }) });
        track.stop = () => { state.live--; state.stops++; clearInterval(timer); stop(); };
      }
      if (state.delay) await new Promise(resolve => setTimeout(resolve, state.delay));
      return stream;
    } });
  });
  const state = () => page.evaluate(() => (window as any).selectionTest);
  try {
    await page.goto(url);
    await page.getByRole('button', { name: '↙ Receive', exact: true }).click();
    await page.getByRole('button', { name: 'Start camera', exact: true }).click();
    await page.getByRole('button', { name: 'Stop camera', exact: true }).waitFor();
    await page.getByLabel('Camera', { exact: true }).selectOption('wide', { timeout: 3000 });
    await page.getByRole('button', { name: 'Stop camera', exact: true }).waitFor();
    let current = await state();
    assert.deepEqual(current.requests.at(-1).video.deviceId, { exact: 'wide' });
    assert.equal(current.requests.at(-1).video.facingMode, undefined);
    assert.equal(current.stops, 1); assert.equal(current.live, 1);
    await page.waitForTimeout(250);
    assert.equal((await state()).requests.length, 2); // No automatic reopen/switch loop.
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.getByRole('button', { name: 'Stop camera', exact: true }).click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download scan diagnostics' }).click()]);
    const report = JSON.parse(await Bun.file((await download.path())!).text());
    assert.equal(report.environment.camera.selection, 'explicit-device');
    assert.equal(report.environment.camera.deviceId, undefined);
    assert.ok(!JSON.stringify(report).includes('Back Camera'));
    await page.getByRole('button', { name: 'Reset reader' }).click();
    assert.equal(await page.getByLabel('Camera', { exact: true }).inputValue(), 'wide');
    await page.evaluate(() => { (window as any).selectionTest.fail = true; });
    await page.getByRole('button', { name: 'Start camera', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'selected camera' }).waitFor();
    current = await state();
    assert.equal(current.requests.length, 3); assert.equal(current.live, 0); // No silent fallback.
    await page.evaluate(() => Object.assign((window as any).selectionTest, { fail: false, delay: 200 }));
    await page.getByRole('button', { name: 'Start camera', exact: true }).click();
    await page.getByRole('button', { name: 'Cancel camera request', exact: true }).click();
    await page.waitForTimeout(350);
    assert.equal((await state()).live, 0);
    await page.getByLabel('Camera', { exact: true }).selectOption('');
    await page.evaluate(() => Object.assign((window as any).selectionTest, { delay: 0, enumerationFails: true }));
    await page.getByRole('button', { name: 'Start camera', exact: true }).click();
    await page.getByRole('button', { name: 'Stop camera', exact: true }).waitFor();
    assert.equal((await state()).live, 1); // Enumeration failure must not break capture.
    await page.getByRole('button', { name: 'Stop camera', exact: true }).click();
    assert.equal((await state()).live, 0);
    return 'Explicit camera selection survives reset, releases old/late streams, and never silently falls back; enumeration failure preserves capture';
  } finally { await page.close(); }
}
