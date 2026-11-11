// End-to-end playthrough using real key input where it matters, teleports between objectives.
const tp = (G, x, z, yaw) => G(([x, z, yaw]) => { const g = window.__game; g.player.hp = g.player.maxHp; g.player.place(x, z, yaw); g.rig.targetYaw = yaw + Math.PI; g.rig.snap(g.player.pos); }, [x, z, yaw]);
const state = (G) => G(() => { const g = window.__game; return { mode: g.mode, area: g.area, hp: g.player.hp, inv: { ...g.inv.counts }, eq: { ...g.inv.equipped }, stage: g.quest.stage(), flags: [...g.quest.flags], dialog: g.ui.dialogOpen, prompt: g.interactTarget?.label ?? null, pos: g.player.pos.toArray().map((v) => +v.toFixed(2)) }; });
const closeDialogs = async ({ page, G, frames }) => { for (let i = 0; i < 12; i++) { const s = await G(() => ({ d: window.__game.ui.dialogOpen, m: window.__game.mode })); if (!s.d && s.m !== 'itemget') return; await page.keyboard.press('KeyE'); await frames(6); } };
export default {
  async full(ctx) {
    const { page, G, frames, shot, key } = ctx;
    const log = async (t) => console.log(t, JSON.stringify(await state(G)));
    await page.click('[data-m=new]'); await frames(4);
    await page.click('[data-cr=done]'); await frames(4);
    await closeDialogs(ctx);
    await log('start');
    // walk forward a bit with real keys
    await key('KeyW', 900); await frames(3); await log('walked');
    // 1) elder
    await tp(G, -9, 19.2, Math.PI); await frames(4); await log('near elder');
    await page.keyboard.press('KeyE'); await frames(6); await shot('f_dialog');
    await closeDialogs(ctx); await log('after elder');
    // 2) sword chest
    await tp(G, 17.5 + 1.6 * Math.sin(-0.6), 17 + 1.6 * Math.cos(-0.6), -0.6 + Math.PI); await frames(4); await log('near chest');
    await page.keyboard.press('KeyE'); await frames(30); await shot('f_itemget');
    await closeDialogs(ctx); await log('after sword');
    // 3) attack an acorn beetle
    await G(() => { const g = window.__game; const e = g.enemies.find((e) => e.type === 'acorn'); g.player.place(e.pos.x, e.pos.z + 2, Math.PI); g.rig.snap(g.player.pos); });
    await frames(3);
    const hp0 = await G(() => window.__game.enemies.find((e) => e.type === 'acorn').hp);
    for (let i = 0; i < 3; i++) { await page.keyboard.press('KeyJ'); await frames(4); }
    await shot('f_combat');
    await frames(20);
    const hp1 = await G(() => { const e = window.__game.enemies.find((e) => e.type === 'acorn' && (e.dead || e.hp < 3)); return e ? e.hp : 'none'; });
    console.log('acorn hp', hp0, '->', hp1);
    // 4) ruins push block: stand west of block facing +x and walk
    await tp(G, 48.3, 47, Math.PI / 2); await frames(3);
    for (let i = 0; i < 6; i++) {
      await G(() => { const g = window.__game; const b = g.ruinsBlock; g.player.place(b.col.x - 1.45, b.col.z, Math.PI / 2); });
      await page.keyboard.down('KeyD'); await frames(40); await page.keyboard.up('KeyD'); await frames(30);
      const b = await G(() => [window.__game.ruinsBlock.col.x, window.__game.ruinsBlock.col.z, window.__game.quest.has('ruinsOpen')]);
      console.log('block', b); if (b[2]) break;
    }
    await shot('f_ruins');
    // lantern chest inside court
    await tp(G, 56, 59 - 1.9, 0); await frames(6); await log('near lantern');
    await page.keyboard.press('KeyE'); await frames(30); await closeDialogs(ctx); await log('after lantern');
    // 5) cave
    await tp(G, -31 + Math.sin(0.65) * 3.5, -46.5 + Math.cos(0.65) * 3.5, 0.65 + Math.PI); await frames(4); await log('at cave');
    await page.keyboard.press('KeyE'); await frames(60); await G(() => { window.__game.player.inv = 1e9; }); await log('in dungeon'); await shot('f_dungeon');
    // torches
    for (const x of [996, 1004]) { await tp(G, x, -2, Math.PI); await frames(3); await page.keyboard.press('KeyQ'); await frames(10); }
    await frames(60); await log('torches'); await shot('f_torches');
    // room B block -> plate at (1004,-22). block at (996,-18): push +x 4 times, then -z (push south->north? plate z=-22: push in -z twice)
    const pushTo = async (dx, dz) => {
      await G(([dx, dz]) => { const g = window.__game, b = g.dungeon.blockB; g.player.place(b.col.x - dx * 1.45, b.col.z - dz * 1.45, Math.atan2(dx, dz)); g.rig.targetYaw = Math.atan2(dx, dz) + Math.PI; }, [dx, dz]);
      const k = dx > 0 ? 'KeyD' : dx < 0 ? 'KeyA' : dz > 0 ? 'KeyS' : 'KeyW';
      await G(() => { window.__game.rig.targetYaw = 0; window.__game.rig.yaw = 0; });
      await page.keyboard.down(k); await frames(40); await page.keyboard.up(k); await frames(30);
    };
    for (let i = 0; i < 4; i++) await pushTo(1, 0);
    for (let i = 0; i < 2; i++) await pushTo(0, -1);
    console.log('blockB', await G(() => [window.__game.dungeon.blockB.col.x, window.__game.dungeon.blockB.col.z, window.__game.dungeon.plateB.pressed, window.__game.dungeon.gateB.open]));
    await shot('f_roomB');
    // room C: kill enemies via damage API (AI/combat already verified)
    await tp(G, 1000, -36, Math.PI); await frames(10);
    await G(() => { const g = window.__game; for (const e of g.enemies) if (Math.abs(e.home.z + 40) < 8 || Math.abs(e.home.z + 20) < 8) e.damage(99, g.player.pos); });
    await frames(60); await log('room C cleared');
    await tp(G, 1000, -38.2, Math.PI); await frames(4); await page.keyboard.press('KeyE'); await frames(30); await closeDialogs(ctx); await log('key');
    await tp(G, 1000, -45.5, Math.PI); await frames(4); await page.keyboard.press('KeyE'); await frames(30); await log('door');
    // boss
    await tp(G, 1000, -58, Math.PI); await frames(60); await shot('f_boss');
    await G(() => { const g = window.__game; g.boss.state = 'stun'; g.boss.dizzy = 2; });
    await G(() => { const g = window.__game; const b = g.boss; g.player.hp = g.player.maxHp; g.player.place(b.pos.x, b.pos.z + 3.4, Math.PI); });
    for (let i = 0; i < 3; i++) { await page.keyboard.press('KeyJ'); await frames(5); }
    console.log('boss hp after combo', await G(() => window.__game.boss?.hp));
    await G(() => { const g = window.__game; g.boss.damage(99, g.player.pos); });
    await frames(120); await shot('f_bossdead');
    await G(() => { const g = window.__game; for (const k of g.pickups) g.player.place(k.pos.x, k.pos.z, 0); });
    await frames(10); await closeDialogs(ctx);
    await G(() => { const g = window.__game; for (const k of g.pickups) g.player.place(k.pos.x, k.pos.z, 0); });
    await frames(10); await closeDialogs(ctx); await log('after boss');
    // exit and temple
    await tp(G, 1000, 7.5, 0); await frames(3); await page.keyboard.press('KeyE'); await frames(60); await log('outside');
    await tp(G, 0, -79.5, Math.PI); await frames(6); await log('temple');
    await page.keyboard.press('KeyE'); await frames(200); await shot('f_ending'); await log('ending');
    // save/load
    await G(() => window.__game.save());
    const saved = await G(() => JSON.parse(localStorage.getItem('wave-isle-save-v1')).flags);
    console.log('saved flags', saved);
    await page.click('[data-c=title]').catch(() => {}); await frames(10);
    await page.click('[data-m=continue]'); await frames(10); await log('continued');
    await page.keyboard.press('KeyI'); await frames(5); await shot('f_inventory');
  },
};
