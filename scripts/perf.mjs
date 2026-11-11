export default { async perf({ page, G, frames }) {
  await page.click('[data-m=new]'); await frames(3); await page.click('[data-cr=done]'); await frames(3);
  await G(() => window.__game.ui.advance());
  const r = await G(async () => {
    const g = window.__game; const ri = g.rs.renderer.info;
    let inst = {}; g.scene.traverse((o) => { if (o.isInstancedMesh) { const k = (o.material.type || '') ; inst[k] = (inst[k] || 0) + o.count; } });
    const cl = g.world.cliffs.map((c) => c.meshes.reduce((a, m) => a + m.count, 0));
    const t0 = performance.now(); const f0 = window.__frames; await new Promise((r) => setTimeout(r, 6000));
    return { fps: ((window.__frames - f0) / ((performance.now() - t0) / 1000)).toFixed(2), calls: ri.render.calls, tris: ri.render.triangles, cliffs: cl, inst };
  });
  console.log(JSON.stringify(r));
} };
