// Usage: node scripts/shot.mjs <url> <out.png> [waitFrames] [w] [h]
import { createRequire } from 'module'; const require = createRequire('/opt/node22/lib/node_modules/'); const { chromium } = require('playwright');
const [url, out, wait = '40', w = '1280', h = '720'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(url, { waitUntil: 'load', timeout: 180000 });
const t0 = Date.now();
await page.waitForFunction((n) => (window.__frames || 0) >= n, +wait, { timeout: 300000 }).catch((e) => errors.push('timeout ' + e.message));
const secs = (Date.now() - t0) / 1000;
await page.screenshot({ path: out, timeout: 300000 });
console.log('frames', await page.evaluate(() => window.__frames), 'secs', secs.toFixed(1));
console.log(errors.slice(0, 15).join('\n'));
await browser.close();
