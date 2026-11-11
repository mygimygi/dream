// Final chapters: map2 dig -> King Crab (bomb breaks shell) -> stones at altar -> sky garden -> Storm Jellyfish (arrow to eye, sword when fallen) -> ending
export default { async fin({ page, G, frames, shot }) {
  const log = (t, v) => console.log(t, typeof v === 'string' ? v : JSON.stringify(v));
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message, (e.stack || '').split('\n').slice(0, 3).join(' | ')));
  const tp = (x, z, yaw = 0) => G(([x, z, yaw]) => { const g = window.__game; g.player.hp = g.player.maxHp; g.player.place(x, z, yaw); g.rig.targetYaw = yaw + Math.PI; g.rig.snap(g.player.pos); }, [x, z, yaw]);
  const close = async () => { for (let i = 0; i < 14; i++) { const s = await G(() => ({ d: window.__game.ui.dialogOpen, m: window.__game.mode, r: window.__game.ui.resultOpen })); if (!s.d && s.m !== 'itemget' && !s.r) return; await page.keyboard.press('KeyE'); await frames(5); } };
  await page.click('[data-m=new]'); await frames(3); await page.click('[data-cr=done]'); await frames(3); await close();
  // fast-forward story to chapter 7 (m1..m6 rewarded) with the items the player would have
  await G(() => { const g = window.__game; for (const id of ['m1', 'm2', 'm3', 'm4', 'm5', 'm6']) g.qm.state[id] = 'rewarded'; g.qm.state.m7 = 'active';
    ['metElder', 'bossDead', 'pearlPlaced', 'guardianDead', 'enteredCave'].forEach((f) => g.quest.flags.add(f)); g.inv.add('sword'); g.inv.add('lantern'); g.inv.add('windForest'); g.inv.add('bow'); g.inv.add('arrow', 30); g.inv.add('bomb', 8); g.inv.maxHearts = 8; g.player.hp = 16; g.qm.refresh(); });
  log('main quest', await G(() => window.__game.qm.activeMain()?.title));
  // fisher gives map2
  await tp(1.5, 74.5, Math.PI); await frames(3); await page.keyboard.press('KeyE'); await frames(4); await close();
  log('map2/shovel', await G(() => [window.__game.inv.has('map2'), window.__game.inv.has('shovel')]));
  // dig at gull rock sands
  await G(() => window.__game.inv.wear('shovel')); await tp(16, 86.5, 0); await frames(3); await page.keyboard.press('KeyQ'); await frames(10); await close(); await frames(20);
  const crab = await G(() => !!window.__game.enemies.find((e) => e.type === 'kingCrab'));
  log('king crab emerged', crab); await shot('f_kingcrab');
  // sword does nothing while hidden; a bomb exposes it
  await G(() => { const g = window.__game, e = g.enemies.find((x) => x.type === 'kingCrab'); e.set('hide'); });
  const hp0 = await G(() => window.__game.enemies.find((x) => x.type === 'kingCrab').hp);
  await G(() => { const g = window.__game, e = g.enemies.find((x) => x.type === 'kingCrab'); e.damage(3, g.player.pos); });
  const hp1 = await G(() => window.__game.enemies.find((x) => x.type === 'kingCrab').hp);
  await G(() => { const g = window.__game, e = g.enemies.find((x) => x.type === 'kingCrab'); e.bombHit(); });
  const exposed = await G(() => window.__game.enemies.find((x) => x.type === 'kingCrab').state);
  log('sword blocked while hidden / bomb exposes', [hp0, hp1, exposed]);
  await G(() => { const g = window.__game, e = g.enemies.find((x) => x.type === 'kingCrab'); e.damage(99, g.player.pos); }); await frames(100);
  await G(() => { const g = window.__game; for (const k of g.pickups) if (k.big) g.player.place(k.pos.x, k.pos.z, 0); }); await frames(6); await close();
  await G(() => { const g = window.__game; for (const k of g.pickups) if (k.big) g.player.place(k.pos.x, k.pos.z, 0); }); await frames(6); await close();
  log('windSea + m8', await G(() => [window.__game.inv.has('windSea'), window.__game.qm.activeMain()?.id]));
  // altar: place stones -> sky
  await tp(0, -79.8, Math.PI); await frames(3); await page.keyboard.press('KeyE'); await frames(4); await close(); await frames(60);
  log('area after altar', await G(() => [window.__game.area, window.__game.quest.has('stonesPlaced')]));
  await frames(40); await shot('f_sky');
  // storm: sword can't hurt it while floating; arrow to the open eye drops it; then sword works
  await G(() => { const g = window.__game, e = g.enemies.find((x) => x.type === 'storm'); e.set('float'); });
  const s0 = await G(() => window.__game.enemies.find((x) => x.type === 'storm').hp);
  await G(() => { const g = window.__game, e = g.enemies.find((x) => x.type === 'storm'); e.damage(2, g.player.pos); });
  const s1 = await G(() => window.__game.enemies.find((x) => x.type === 'storm').hp);
  // open its eye and shoot a real arrow at it
  await G(() => { const g = window.__game, e = g.enemies.find((x) => x.type === 'storm'); e.set('eye'); e.vel.set(0, 0, 0); g.player.place(e.pos.x, e.pos.z + 7, Math.PI); g.player.yaw = Math.PI; g.inv.wear('bow'); });
  await frames(3);
  for (let i = 0; i < 4; i++) { await page.keyboard.press('KeyQ'); await frames(14); if (await G(() => window.__game.enemies.find((x) => x.type === 'storm').state === 'fallen')) break; await G(() => { const g = window.__game, e = g.enemies.find((x) => x.type === 'storm'); e.set('eye'); }); }
  const fallen = await G(() => window.__game.enemies.find((x) => x.type === 'storm').state);
  await shot('f_storm_fallen');
  await G(() => { const g = window.__game, e = g.enemies.find((x) => x.type === 'storm'); e.set('fallen'); e.damage(2, g.player.pos); });
  const s2 = await G(() => window.__game.enemies.find((x) => x.type === 'storm').hp);
  log('storm: float-immune / arrow drops it / sword when fallen', [s0, s1, fallen, s2]);
  await G(() => { const g = window.__game, e = g.enemies.find((x) => x.type === 'storm'); e.set('fallen'); e.damage(99, g.player.pos); });
  await frames(160); await close(); await frames(10);
  log('ending', await G(() => [window.__game.quest.has('finalBossDead'), window.__game.quest.has('ending'), window.__game.qm.state.m8, !document.querySelector('[data-k=credits]').hidden]));
  await shot('f_credits');
} };
