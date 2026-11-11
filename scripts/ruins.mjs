export default { async ruins({ page, G, frames, shot }) {
  await page.click('[data-m=new]'); await frames(3);
  await G(() => { const g = window.__game; g.ui.advance(); g.ui.advance(); g.inv.add('sword'); });
  for (let i = 0; i < 6; i++) {
    await G(() => { const g = window.__game; const b = g.ruinsBlock; g.player.place(b.col.x - 1.45, b.col.z, Math.PI / 2); g.rig.targetYaw = 0; g.rig.yaw = 0; });
    await page.keyboard.down('KeyD'); await frames(25); await page.keyboard.up('KeyD'); await frames(25);
    const b = await G(() => [window.__game.ruinsBlock.col.x, window.__game.ruinsBlock.col.z, window.__game.quest.has('ruinsOpen')]);
    console.log('block', JSON.stringify(b)); if (b[2]) break;
  }
  await frames(40); await shot('ruins_open');
  // reset flow in dungeon
  await G(() => { const g = window.__game; const b = g.dungeon.blockB; b.setPos(1006, -24); g.setArea('dungeon'); g.player.place(1006, -21.6, Math.PI); });
  await frames(5);
  console.log('prompt', await G(() => window.__game.interactTarget?.label));
  await page.keyboard.press('KeyE'); await frames(5);
  console.log('after reset', await G(() => [window.__game.dungeon.blockB.col.x, window.__game.dungeon.blockB.col.z]));
} };
