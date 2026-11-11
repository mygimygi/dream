const base = {
  async title({ shot, frames }) { await frames(5); await shot('title'); },
  async start({ page, G, frames, shot }) {
    await page.click('[data-m=new]'); await frames(5);
    await shot('start_dialog');
    await page.keyboard.press('KeyE'); await frames(2); await page.keyboard.press('KeyE'); await frames(5);
    await shot('start_play');
  },
  async tour({ G, frames, shot, page }) {
    await page.click('[data-m=new]'); await frames(3);
    await G(() => { window.__game.ui.advance(); window.__game.ui.advance(); });
    const spots = JSON.parse(process.env.SPOTS || '[]');
    for (const [name, x, z, yaw, d, p] of spots) {
      await G(([x, z, yaw, d, p]) => { const g = window.__game; g.player.place(x, z, yaw); g.rig.targetYaw = yaw + Math.PI; g.rig.targetDist = d ?? 12.5; g.rig.targetPitch = p ?? 0.74; g.rig.snap(g.player.pos); g.region = ''; }, [x, z, yaw, d, p]);
      await frames(6);
      await shot(name);
    }
  },
};
export const reach = async ({ G }) => {
  const r = await G(() => {
    const g = window.__game, hf = g.world.hf, N = hf.n, H = hf.heights, CELL = 0.75, HALF = 132;
    const idx = (x, z) => Math.round((z + HALF) / CELL) * N + Math.round((x + HALF) / CELL);
    const ground = (k) => { const i = k % N, j = (k / N) | 0; const x = -HALF + i * CELL, z = -HALF + j * CELL; return g.world.groundAt(x, z, H[k] + 3); };
    const seen = new Uint8Array(N * N); const GY = new Float32Array(N * N); const q = [idx(10.5, 19.5)]; seen[q[0]] = 1; GY[q[0]] = ground(q[0]);
    while (q.length) { const k = q.pop(); const gk = GY[k]; const i = k % N, j = (k / N) | 0;
      for (const [di, dj] of [[1,0],[-1,0],[0,1],[0,-1]]) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= N || jj >= N) continue; const kk = jj * N + ii;
        const x = -HALF + ii * CELL, z = -HALF + jj * CELL; const gn = g.world.groundAt(x, z, gk + 0.6); if (seen[kk] && gn <= GY[kk] + 0.3) continue;
        if (gn - gk > 0.6) continue; if (H[kk] < -0.75 && gn < -0.5) continue;
        seen[kk] = 1; GY[kk] = gn; q.push(kk); } }
    const pts = { ...Object.fromEntries([...g.chests.values()].filter(c => !c.def.dungeon).map(c => [c.def.id, [c.def.x + 1.6 * Math.sin(c.def.yaw), c.def.z + 1.6 * Math.cos(c.def.yaw)]])),
      p1: [30, 22], p2: [36, 6], p3: [40, -8], p4: [44, -10], p5: [50, -10], p6: [58, -10], cave: [-31 + Math.sin(0.65) * 4, -46.5 + Math.cos(0.65) * 4], temple: [0, -76], ruinsBlockW: [48, 47], elder: [-9, 18.5], baker: [-9, 31], fisher: [2, 75.5], kid: [-18, 27.5], lakeIsle: [64, -10] };
    const out = {};
    for (const [k, [x, z]] of Object.entries(pts)) { let ok = false; for (let dx = -1.5; dx <= 1.5; dx += 0.75) for (let dz = -1.5; dz <= 1.5; dz += 0.75) if (seen[idx(x + dx, z + dz)]) ok = true; out[k] = ok; }
    return out;
  });
  console.log(JSON.stringify(r));
};
export default { ...base, reach };
