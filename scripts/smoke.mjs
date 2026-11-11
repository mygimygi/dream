export default { async smoke({ page, G, frames, shot }) {
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message, (e.stack || '').split('\n').slice(0, 3).join(' | ')));
  await page.click('[data-m=new]'); await frames(3); await page.click('[data-cr=done]'); await frames(6);
  await shot('x_start');
  console.log(JSON.stringify(await G(() => { const g = window.__game; return { mode: g.mode, clock: g.time_.label(), main: g.qm.activeMain()?.title, avail: Object.entries(g.qm.state).filter(([k, v]) => v === 'available').map(([k]) => k), markers: g.npcs.map((n) => n.id + ':' + g.qm.marker(n.id)) }; })));
} };
