export default { async guide({ page, G, frames, shot }) {
  await page.click('[data-m=new]'); await frames(4);
  await G(() => window.__game.ui.advance()); await frames(4);
  const info = () => G(() => { const e = document.querySelector('[data-k=guide]'); return { hidden: e.hidden, on: e.classList.contains('on'), label: e.textContent, t: e.style.transform }; });
  console.log('start', JSON.stringify(await info())); await shot('g_start');
  await G(() => { const g = window.__game; g.player.place(-9, 12, Math.PI); g.rig.targetYaw = 0; g.rig.snap(g.player.pos); }); await frames(6);
  console.log('near elder', JSON.stringify(await info())); await shot('g_near');
  await G(() => { const g = window.__game; g.player.place(40, 60, 0); g.rig.targetYaw = Math.PI; g.rig.snap(g.player.pos); }); await frames(6);
  console.log('far behind', JSON.stringify(await info())); await shot('g_far');
} };
