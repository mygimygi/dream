export default { async mm({ page, G, frames, shot }) {
  await page.click('[data-m=new]'); await frames(4); await G(() => window.__game.ui.advance()); await frames(3);
  // simulate exiting the cave: same placement + camera as the real exit
  await G(() => { const g = window.__game, y = 0.65; g.player.place(-31 + Math.sin(y) * 4, -46.5 + Math.cos(y) * 4, y); g.rig.targetYaw = y + Math.PI; g.rig.snap(g.player.pos); });
  await frames(5);
  const before = await G(() => window.__game.player.pos.toArray());
  await page.keyboard.down('KeyW'); await frames(25); await shot('mm_exit'); await page.keyboard.up('KeyW');
  const after = await G(() => window.__game.player.pos.toArray());
  const cy = await G(() => window.__game.rig.yaw);
  const d = [after[0] - before[0], after[2] - before[2]];
  // movement as drawn on the camera-aligned minimap (canvas y down = screen down)
  const mx = d[0] * Math.cos(cy) - d[1] * Math.sin(cy), my = d[0] * Math.sin(cy) + d[1] * Math.cos(cy);
  console.log('world move', d.map((v) => v.toFixed(2)), 'minimap move (x,y)', mx.toFixed(2), my.toFixed(2), my < 0 ? '=> UP on minimap (correct)' : '=> DOWN (wrong)');
} };
