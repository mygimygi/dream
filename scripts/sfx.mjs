export default { async sfx({ page, G, frames }) {
  await page.click('[data-m=new]'); await frames(3);
  const r = await G(async () => { const a = window.__game.audio; a.unlock(); const names = ['swing','spin','hit','hurt','cut','pot','enemyDie','block','creature','alert','bossDie','thud','itemGet','chest'];
    const errs = []; for (const n of names) { try { a.play(n); } catch (e) { errs.push(n + ':' + e.message); } await new Promise((r) => setTimeout(r, 120)); }
    return { state: a.ctx?.state, errs }; });
  console.log(JSON.stringify(r));
} };
