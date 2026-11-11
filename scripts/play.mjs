// Scripted play-test: starts a new game, runs actions, captures screenshots + console errors.
// Usage: node scripts/play.mjs <baseUrl> <outDir> <scenario>
import { createRequire } from 'module';
const require = createRequire(process.env.PW_ROOT + '/');
const { chromium } = require('playwright');
const [base, outDir, scenario = 'basic', w = '1280', h = '720', mobile = ''] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext(mobile ? { viewport: { width: +w, height: +h }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 } : { viewport: { width: +w, height: +h } });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + e.stack));
await page.goto(base, { waitUntil: 'load', timeout: 180000 });
await page.waitForFunction(() => (window.__frames || 0) > 3, null, { timeout: 300000 });
const G = (fn, arg) => page.evaluate(fn, arg);
const frames = async (n) => { const f0 = await G(() => window.__frames); await page.waitForFunction((t) => window.__frames >= t, f0 + n, { timeout: 300000 }); };
const shot = async (name) => { await page.screenshot({ path: `${outDir}/${name}.png`, timeout: 300000 }); console.log('shot', name); };
const key = async (k, ms = 300) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); };
const scenarios = (await import(process.env.SCEN)).default;
await scenarios[scenario]({ page, G, frames, shot, key });
console.log('ERRORS:', errors.length ? errors.slice(0, 10).join('\n') : 'none');
await browser.close();
