export default { async fix3({ page, G, frames, shot }) {
  const close = async () => { for (let i = 0; i < 14; i++) { const s = await G(() => ({ d: window.__game.ui.dialogOpen, m: window.__game.mode, r: window.__game.ui.resultOpen })); if (!s.d && s.m !== 'itemget' && !s.r) return; await page.keyboard.press('KeyE'); await frames(5); } };
  await page.click('[data-m=new]'); await frames(3); await page.click('[data-cr=done]'); await frames(3); await close();
  // eat
  await G(() => { const g = window.__game; g.inv.add('soup'); g.player.hp = 2; });
  const a = await G(() => window.__game.player.hp); await G(() => window.__game['useItem']('soup')); const b = await G(() => window.__game.player.hp);
  console.log('eat soup hp', a, '->', b, b > a ? 'PASS' : 'FAIL');
  // rod from fisher (fisher's day spot is the beach)
  const fpos = await G(() => { const n = window.__game.npcs.find((x) => x.id === 'fisher'); return [n.pos.x, n.pos.z]; });
  await G(([x, z]) => { const g = window.__game; g.player.place(x, z + 1.6, Math.PI); }, fpos); await frames(4);
  console.log('prompt at fisher:', await G(() => window.__game.interactTarget?.label), 'fisher at', fpos.map((v) => v.toFixed(1)));
  await page.keyboard.press('KeyE'); await frames(4); await close();
  console.log('rod', await G(() => window.__game.inv.count('rod')), await G(() => window.__game.qm.state.s_fishing));
  // night lighting
  await G(() => { const g = window.__game; g.time_.hour = 22; g.time_.setWeather('rain', 2); g.player.inv = 999; }); await frames(30);
  console.log('night sun', await G(() => [window.__game.time_.isNight, window.__game.world.sun.intensity.toFixed(2), window.__game.world.hemi.intensity.toFixed(2)]));
  await shot('night2');
} };
