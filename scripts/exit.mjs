export default { async exit({ page, G, frames }) {
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message, e.stack?.split('\n').slice(0, 4).join(' | ')));
  await page.click('[data-m=new]'); await frames(3); await page.click('[data-cr=done]'); await frames(3);
  await G(() => { const g = window.__game; g.ui.advance(); g.inv.add('lantern'); g.inv.add('sword'); g.player.place(-31 + Math.sin(0.65) * 3.5, -46.5 + Math.cos(0.65) * 3.5, 0.65 + Math.PI); });
  await frames(3); await page.keyboard.press('KeyE');
  for (let i = 0; i < 6; i++) { await page.waitForTimeout(1500); console.log('t', i, await G(() => [window.__frames, window.__game.mode, window.__game.area])); }
  await G(() => { const g = window.__game; g.player.place(1000, 7.5, 0); }); await frames(3);
  await page.keyboard.press('KeyE');
  for (let i = 0; i < 8; i++) { await page.waitForTimeout(1500); console.log('x', i, await G(() => [window.__frames, window.__game.mode, window.__game.area])); }
} };
