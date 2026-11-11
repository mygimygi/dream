export default { async temple({ page, G, frames, shot }) {
  await page.click('[data-m=new]'); await frames(4); await G(() => window.__game.ui.advance()); await frames(3);
  for (const [name, yaw] of [['tp_a', Math.PI], ['tp_b', Math.PI + 0.63], ['tp_c', 0.3]]) {
    await G((yaw) => { const g = window.__game; g.player.place(0, -79.8, 0); g.rig.targetYaw = yaw; g.rig.snap(g.player.pos); }, yaw);
    await frames(40); await shot(name);
  }
} };
