export default { async create({ page, G, frames, shot }) {
  await page.click('[data-m=new]'); await frames(25);
  await shot('cr_default');
  await page.click('.chip[data-v=m]'); await frames(3);
  await page.click('.sw[data-g=hair][data-v=black]'); await frames(3);
  await page.click('.sw[data-g=outfit][data-v=crimson]'); await frames(3);
  await page.fill('#cr-name', '바다'); await frames(15);
  await shot('cr_male');
  await page.click('[data-cr=random]'); await frames(15); await shot('cr_random');
  await page.click('.chip[data-v=f]'); await page.click('.chip[data-v=braids]'); await page.click('.sw[data-g=hair][data-v=pink]');
  await page.locator('input[data-g=eyeSize]').fill('1.35'); await frames(15); await shot('cr_female');
  await page.click('[data-cr=done]'); await frames(8);
  console.log('after start', JSON.stringify(await G(() => { const g = window.__game; return { mode: g.mode, name: g.playerName, app: g.appearance, dlg: document.querySelector('[data-k=who]').textContent }; })));
  await G(() => { const g = window.__game; g.ui.advance(); g.ui.advance(); g.inv.add('shell', 300); g.inv.add('berry', 5); g.inv.add('sword'); g.player.place(-3.5, 34.8, Math.PI); g.rig.targetYaw = 0; g.rig.snap(g.player.pos); });
  await frames(5);
  console.log('prompt', await G(() => window.__game.interactTarget?.label));
  await page.keyboard.press('KeyE'); await frames(5);
  for (let i = 0; i < 6; i++) { if (await G(() => !!document.querySelector('.choices .btn'))) break; await page.keyboard.press('KeyE'); await frames(6); }
  await page.click('.choices .btn.primary'); await frames(5);
  await shot('shop');
  for (const id of ['whaleSword', 'shellArmor', 'turtleShield']) { await page.click(`[data-buy=${id}]`); await frames(4); }
  await shot('shop_after');
  console.log('after buy', JSON.stringify(await G(() => { const g = window.__game; return { eq: g.inv.equipped, shell: g.inv.count('shell'), berry: g.inv.count('berry'), maxHp: g.player.maxHp, hp: g.player.hp, dmg: g.inv.weaponDmg() }; })));
  await page.click('[data-m=close]'); await frames(3);
  await G(() => { const g = window.__game; g.rig.targetDist = 9; g.rig.targetPitch = 0.5; g.rig.targetYaw = Math.PI * 1.2; });
  await frames(40); await shot('gear');
  await G(() => window.__game.save());
  console.log('saved', await G(() => { const d = JSON.parse(localStorage.getItem('wave-isle-save-v1')); return JSON.stringify({ name: d.name, app: d.appearance, eq: d.inventory.equipped }); }));
} };
