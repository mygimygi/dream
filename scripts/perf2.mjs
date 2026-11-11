export default { async perf2({ page, G, frames }) {
  await page.click('[data-m=new]'); await frames(3); await page.click('[data-cr=done]'); await frames(3);
  await G(() => window.__game.ui.advance());
  const fps = () => G(async () => { const t0 = performance.now(), f0 = window.__frames; await new Promise((r) => setTimeout(r, 5000)); return ((window.__frames - f0) / ((performance.now() - t0) / 1000)).toFixed(2); });
  console.log('all', await fps());
  await G(() => window.__game.world.cliffs.forEach((c) => c.meshes.forEach((m) => (m.visible = false), (c.maxDist = -1))));
  await G(() => { const g = window.__game; g.world.cliffs.forEach((c) => { c.updateLOD = () => {}; c.meshes.forEach((m) => (m.visible = false)); }); });
  console.log('no cliffs', await fps());
  await G(() => { const g = window.__game; g.scene.environment = null; });
  console.log('no cliffs, no env', await fps());
  await G(() => { const g = window.__game; g.world.sun.castShadow = false; });
  console.log('+ no shadows', await fps());
} };
