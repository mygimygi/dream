export default { async guide2({ page, G, frames }) {
  await page.click('[data-m=new]'); await frames(4); await G(() => window.__game.ui.advance()); await frames(3);
  const info = () => G(() => { const e = document.querySelector('[data-k=guide]'); return e.hidden ? 'hidden' : e.textContent; });
  console.log('in village (stage0):', await info());
  await G(() => { const g = window.__game; g.player.place(40, 60, 0); }); await frames(4);
  console.log('far from village:', await info());
  await G(() => { const g = window.__game; g.inv.add('sword'); g.quest.set('metElder'); g.player.place(0, 22, 0); }); await frames(4);
  console.log('stage2 at village:', await info());
  await G(() => { const g = window.__game; g.player.place(52, 44, 0); }); await frames(4);
  console.log('stage2 inside ruins:', await info());
  await G(() => { const g = window.__game; g.setArea('dungeon'); g.player.place(1000, 5, Math.PI); }); await frames(4);
  console.log('dungeon:', await info());
} };
