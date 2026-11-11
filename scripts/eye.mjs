export default { async eye({ page, G, frames, shot }) {
  const close = async () => { for (let i = 0; i < 14; i++) { const s = await G(() => ({ d: window.__game.ui.dialogOpen, m: window.__game.mode })); if (!s.d && s.m !== 'itemget') return; await page.keyboard.press('KeyE'); await frames(5); } };
  await page.click('[data-m=new]'); await frames(3); await page.click('[data-cr=done]'); await frames(3); await close();
  await G(() => { const g = window.__game; g.inv.add('sword'); g.inv.add('bow'); g.inv.add('arrow', 20); g.inv.maxHearts = 10; g.player.hp = 20; g.quest.set('stonesPlaced'); g.enterSky(); });
  await frames(70);
  let fell = false;
  for (let i = 0; i < 5 && !fell; i++) {
    await G(() => { const g = window.__game, e = g.enemies.find((x) => x.type === 'storm'); e.set('eye'); e.vel.set(0, 0, 0); g.player.place(e.pos.x, e.pos.z + 7, Math.PI); g.player.yaw = Math.PI; g.inv.wear('bow'); g.player.hp = 20; });
    await frames(10); await page.keyboard.press('KeyQ'); await frames(16);
    fell = await G(() => window.__game.enemies.find((x) => x.type === 'storm').state === 'fallen');
  }
  console.log('real arrow knocks storm down:', fell ? 'PASS' : 'FAIL');
  await shot('eye_fallen');
} };
