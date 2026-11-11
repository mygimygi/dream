export default { async m2({ page, G, frames, shot }) {
  await page.tap('[data-m=new]'); await frames(4); await page.tap('[data-cr=done]'); await frames(4);
  for (let i = 0; i < 4; i++) { if (await G(() => window.__game.ui.dialogOpen)) { await page.tap('.dialog'); await frames(3); } }
  const client = await page.context().newCDPSession(page);
  const box = await page.locator('.stick').boundingBox(); const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const z0 = await G(() => window.__game.player.pos.z);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy, id: 1 }] });
  for (let i = 1; i <= 6; i++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx, y: cy + i * 9, id: 1 }] });
  await frames(20); await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const z1 = await G(() => window.__game.player.pos.z);
  console.log('T9 move', Math.abs(z1 - z0) > 0.5 ? 'PASS' : 'FAIL', (z1 - z0).toFixed(1));
  await shot('m9_hud');
  await page.tap('.rbtn[data-k=btnInv]'); await frames(4); await shot('m9_inv');
  const fits = await G(() => { const r = document.querySelector('.panel').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1; });
  console.log('T9 inventory fits screen', fits ? 'PASS' : 'FAIL');
  await page.tap('[data-m=map]'); await frames(4); await shot('m9_map');
  console.log('T9 map opens', (await G(() => !!document.querySelector('.bigmap'))) ? 'PASS' : 'FAIL');
  await page.tap('[data-m=close]'); await frames(3);
  // dialogue with a villager via the touch interact button
  const kid = await G(() => { const n = window.__game.npcs.find((x) => x.id === 'kid'); return [n.pos.x, n.pos.z]; });
  await G(([x, z]) => window.__game.player.place(x, z + 1.6, Math.PI), kid); await frames(4);
  await page.tap('.tb.act'); await frames(4);
  console.log('T9 dialogue via touch', (await G(() => window.__game.ui.dialogOpen)) ? 'PASS' : 'FAIL');
  await shot('m9_dialog');
  for (let i = 0; i < 4; i++) { if (await G(() => window.__game.ui.dialogOpen)) { await page.tap('.dialog'); await frames(3); } }
  // fishing via touch tool button
  await G(() => { const g = window.__game; g.inv.add('rod'); g.inv.wear('rod'); const hf = g.world.hf; let z = 70; for (; z < 110; z += 0.5) if (hf.height(2, z) < 0.15) break; g.player.place(2, z - 3, 0); });
  await frames(4); await page.tap('.tb.tool'); await frames(10);
  console.log('T9 fishing via touch', (await G(() => window.__game.fishing.st !== 'idle')) ? 'PASS' : 'FAIL');
  await shot('m9_fish');
} };
