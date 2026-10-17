// Frame-accurate renderer: steps the timeline in headless Chromium, writes JPEG frames,
// then muxes them with the soundtrack into an H.264/AAC MP4.
//
//   node tools/render.mjs film   out.mp4   # 1920×1080, the film only
//   node tools/render.mjs framed out.mp4   # 1440×1080, framed with the chapter timeline
//
// Needs: node 18+, playwright (chromium), ffmpeg, and the page served on http://127.0.0.1:8765
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const require = createRequire('/opt/node22/lib/node_modules/');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = createRequire(import.meta.url)('playwright')); }

const [, , mode = 'film', out = `base44-${mode}.mp4`, workersArg = '3', frameDir0] = process.argv;
const FPS = 30, DURATION = 51.7, FRAMES = Math.ceil(DURATION * FPS);
const VIEW = mode === 'framed' ? { width: 1440, height: 1080 } : { width: 1920, height: 1080 };
const PAGE = `http://127.0.0.1:8765/index.html?mode=${mode === 'framed' ? 'framed' : 'film'}`;
const frameDir = frameDir0 || path.join(tmpdir(), `b44-frames-${mode}`);
const audio = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../audio/soundtrack.m4a');

if (existsSync(frameDir)) rmSync(frameDir, { recursive: true });
mkdirSync(frameDir, { recursive: true });

const browser = await chromium.launch();
const nW = +workersArg;
let done = 0;
const t0 = Date.now();

async function worker(w) {
  const page = await browser.newPage({ viewport: VIEW, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.goto(PAGE, { waitUntil: 'load' });
  await page.waitForFunction(() => window.filmReady === true, null, { timeout: 60000 });
  const settle = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  // warm every decode/cache path once so no frame shows a half-loaded image
  for (let t = 0; t < DURATION; t += 0.2) { await page.evaluate((v) => window.seek(v), t); await settle(); }
  const clip = { x: 0, y: 0, ...VIEW };
  for (let i = w; i < FRAMES; i += nW) {
    await page.evaluate((v) => window.seek(v), i / FPS);
    await settle();
    await page.screenshot({ path: path.join(frameDir, `f_${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 95, clip });
    if (++done % 100 === 0) console.log(`frames ${done}/${FRAMES}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  await page.close();
}
await Promise.all(Array.from({ length: nW }, (_, w) => worker(w)));
await browser.close();

const got = readdirSync(frameDir).filter((f) => f.endsWith('.jpg')).length;
if (got !== FRAMES) throw new Error(`expected ${FRAMES} frames, got ${got}`);

await new Promise((resolve, reject) => {
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', path.join(frameDir, 'f_%05d.jpg'), '-i', audio,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '192k', '-t', String(DURATION), '-movflags', '+faststart', out], { stdio: 'inherit' });
  ff.on('exit', (c) => (c === 0 ? resolve() : reject(new Error('ffmpeg exit ' + c))));
});
console.log('wrote', out, `${((Date.now() - t0) / 1000).toFixed(0)}s`);
