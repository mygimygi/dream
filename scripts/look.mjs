export default { async look({ page, G, frames, shot }) {
  await page.click('[data-m=new]'); await frames(3); await page.click('[data-cr=done]'); await frames(3);
  await G(() => { const g = window.__game; g.ui.advance(); g.player.place(4, 28, 3.6); g.rig.targetYaw = 3.6 + Math.PI; g.rig.snap(g.player.pos); }); await frames(20);
  await shot(process.env.TAG + '_village');
  await G(() => { const g = window.__game; g.player.place(-55, 5, 0.5); g.rig.targetYaw = 0.5 + Math.PI; g.rig.snap(g.player.pos); }); await frames(20);
  await shot(process.env.TAG + '_forest');
} };
