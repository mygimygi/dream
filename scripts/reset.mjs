export default { async reset({ page, G, frames }) {
  await page.click('[data-m=new]'); await frames(3);
  await G(() => { const g = window.__game; g.ui.advance(); g.ui.advance(); g.ruinsBlock.setPos(54, 47); g.player.place(54, 45.2, 0); });
  await frames(5);
  console.log('ruins prompt', await G(() => window.__game.interactTarget?.label));
  await page.keyboard.press('KeyE'); await frames(5);
  console.log('ruins after', await G(() => [window.__game.ruinsBlock.col.x, window.__game.ruinsBlock.col.z]));
  await G(() => { const g = window.__game; g.setArea('dungeon'); g.dungeon.blockB.setPos(1006, -24); g.player.place(1006, -22.3, Math.PI); });
  await frames(5);
  console.log('dungeon prompt', await G(() => window.__game.interactTarget?.label));
  await page.keyboard.press('KeyE'); await frames(5);
  console.log('dungeon after', await G(() => [window.__game.dungeon.blockB.col.x, window.__game.dungeon.blockB.col.z]));
} };
