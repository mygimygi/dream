// Mobile perf probe: load time, CPU update ms, draw calls, triangles, DOM churn while playing.
export default { async pm({ page, G, frames }) {
  const t0 = Date.now();
  await page.tap('[data-m=new]').catch(() => page.click('[data-m=new]')); await frames(3);
  await page.click('[data-cr=done]'); await frames(3);
  await G(() => { const g = window.__game; g.ui.advance(); g.ui.advance(); });
  await G(() => { window.__mut = 0; new MutationObserver((l) => { window.__mut += l.length; }).observe(document.getElementById('ui'), { subtree: true, childList: true, characterData: true, attributes: true }); });
  const spots = [['village', 4, 28], ['forest', -55, 5], ['beach', 6, 80], ['mountain', -4, -40]];
  for (const [n, x, z] of spots) {
    await G(([x, z]) => { const g = window.__game; g.player.place(x, z, 0); g.rig.snap(g.player.pos); window.__mut = 0; }, [x, z]);
    await frames(25);
    const r = await G(() => ({ ...window.__perf, mutPerFrame: (window.__mut / 25).toFixed(1), enemiesUpdated: window.__game.enemies.length }));
    console.log('PERF', n, JSON.stringify({ updMs: r.update.toFixed(2), calls: r.calls, tris: r.tris, mutPerFrame: r.mutPerFrame, enemies: r.enemiesUpdated }));
  }
  console.log('LOAD', JSON.stringify(await G(() => ({ toFirstFrame: window.__loadMs ?? null, quality: window.__game.qLevel, pr: window.__game.rs.renderer.getPixelRatio() }))));
} };
