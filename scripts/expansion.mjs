// Spec PART 19 tests. Uses real key input for actions; teleports between places to save time.
const results = [];
const check = (name, ok, info = '') => { const l = `${ok ? 'PASS' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`; results.push(l); console.log(l); };
export default { async exp({ page, G, frames, shot }) {
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message, (e.stack || '').split('\n').slice(0, 3).join(' | ')));
  const tp = (x, z, yaw = 0) => G(([x, z, yaw]) => { const g = window.__game; if (g.mode === 'dead' || g.player.hp < 3) { g.ui.closePanel(); g.player.hp = g.player.maxHp; g.player.action = 'none'; g.mode = 'play'; } g.player.place(x, z, yaw); g.rig.targetYaw = yaw + Math.PI; g.rig.snap(g.player.pos); }, [x, z, yaw]);
  const close = async () => { for (let i = 0; i < 14; i++) { const s = await G(() => ({ d: window.__game.ui.dialogOpen, m: window.__game.mode, r: window.__game.ui.resultOpen })); if (!s.d && s.m !== 'itemget' && !s.r) return; await page.keyboard.press('KeyE'); await frames(5); } };
  const choose = async (idx = 0) => { for (let i = 0; i < 8; i++) { if (await G(() => !!document.querySelector('.choices .btn'))) { await page.locator('.choices .btn').nth(idx).click(); await frames(4); return true; } await page.keyboard.press('KeyE'); await frames(5); } return false; };
  const st = (q) => G((q) => window.__game.qm.state[q], q);
  const inv = (i) => G((i) => window.__game.inv.count(i), i);
  // ---- T1 new game ----
  await page.click('[data-m=new]'); await frames(3); await page.click('[data-cr=done]'); await frames(4);
  const story = await G(() => document.querySelector('[data-k=dtext]').textContent.length > 5);
  await close();
  const p0 = await G(() => window.__game.player.pos.z); await page.keyboard.down('KeyS'); await frames(20); await page.keyboard.up('KeyS');
  const p1 = await G(() => window.__game.player.pos.z);
  check('T1 시작 스토리 출력', story); check('T1 캐릭터 이동', Math.abs(p1 - p0) > 0.3, `${p0.toFixed(1)}→${p1.toFixed(1)}`);
  check('T1 메인 퀘스트 시작', (await st('m1')) === 'active');
  // ---- T6 NPC quest: kid's toy boat -> shovel ----
  await tp(-18, 27.6, Math.PI); await frames(4); await page.keyboard.press('KeyE'); await frames(4); await close();
  check('T6 퀘스트 수락 (장난감 배)', (await st('s_boat')) === 'active');
  await tp(34, 4.5, Math.PI); await frames(4);
  const lbl = await G(() => window.__game.interactTarget?.label); await page.keyboard.press('KeyE'); await frames(30); await close();
  check('T6 목표 달성 (배 줍기)', (await st('s_boat')) === 'complete', lbl);
  await tp(-18, 27.6, Math.PI); await frames(4); await page.keyboard.press('KeyE'); await frames(4); await close();
  check('T6 보상 획득 (삽)', (await inv('shovel')) === 1 && (await st('s_boat')) === 'rewarded');
  // ---- T2 shovel dig: elder's glasses ----
  await tp(-9, 18.8, Math.PI); await frames(4); await page.keyboard.press('KeyE'); await frames(4); await close();
  for (let i = 0; i < 3; i++) { if ((await st('s_glasses')) === 'active') break; await page.keyboard.press('KeyE'); await frames(4); await close(); }
  check('T2 할머니 안경 퀘스트 수락', (await st('s_glasses')) === 'active');
  await G(() => window.__game.inv.wear('shovel'));
  await tp(5.2, 23.0, 0); await frames(3); await page.keyboard.press('KeyQ'); await frames(30);
  await shot('e_dig'); await close();
  check('T2 땅 파서 보물 발견 → 인벤토리', (await inv('glasses')) === 1);
  await tp(-9, 18.8, Math.PI); await frames(4); await page.keyboard.press('KeyE'); await frames(4); await close();
  check('T2 안경 반납 → 하트 조각', (await inv('heartPiece')) >= 1, `heartPiece=${await inv('heartPiece')}`);
  // ---- T5 cooking ----
  await G(() => { const g = window.__game; g.inv.add('apple', 1); g.inv.add('mushroom', 1); g.player.hp = 2; });
  await tp(-5.5, 26.8, Math.PI); await frames(4);
  const potLbl = await G(() => window.__game.interactTarget?.label); await page.keyboard.press('KeyE'); await frames(4);
  await page.click('.slot[data-id=apple]'); await page.click('.slot[data-id=mushroom]'); await page.click('[data-cook]'); await frames(4);
  await shot('e_cook');
  check('T5 요리 → 음식 인벤토리 추가', (await inv('soup')) === 1, potLbl);
  await page.click('[data-m=close]').catch(() => {}); await frames(2);
  const hp0 = await G(() => window.__game.player.hp); await G(() => window.__game['useItem']('soup')); const hp1 = await G(() => window.__game.player.hp);
  check('T5 먹으면 체력 회복', hp1 > hp0, `${hp0}→${hp1}`);
  check('T5 도감(요리)·레시피 기록', await G(() => window.__game.codex.has('dishes', 'soup') && window.__game.cooking.known.has('r_soup')));
  // ---- T4 fishing ----
  await tp(1.5, 74.5, Math.PI); await frames(3); await page.keyboard.press('KeyE'); await frames(4); await close();
  check('T4 낚싯대 받기', (await inv('rod')) === 1);
  // stand at the shore facing the sea
  const spot = await G(() => { const g = window.__game, hf = g.world.hf; for (let z = 70; z < 110; z += 0.5) { if (hf.height(2, z) < 0.15) return z - 3; } return 90; });
  await tp(2, spot, 0); await frames(3);
  const canFish = await G(() => window.__game.fishing.canFish());
  let caught = 0;
  for (let attempt = 0; attempt < 4 && caught < 1; attempt++) {
    await G(() => window.__game.inv.wear('rod')); await page.keyboard.press('KeyQ');
    for (let t = 0; t < 400; t++) { const s = await G(() => window.__game.fishing.st); if (s === 'bite') break; if (s === 'idle') break; await frames(2); }
    await page.keyboard.press('KeyJ'); await frames(2);
    // hold/release to keep the zone on the fish (simple controller)
    for (let t = 0; t < 600; t++) {
      const f = await G(() => { const fi = window.__game.fishing; return { st: fi.st, zone: fi['zone'], fish: fi['fishY'], zs: 0.24 + fi.rodLevel * 0.04 }; });
      if (f.st !== 'reel') break;
      const want = f.fish > f.zone + f.zs * 0.5;
      if (want) await page.keyboard.down('KeyJ'); else await page.keyboard.up('KeyJ');
      await frames(1);
      if (t === 40) await shot('e_reel');
    }
    await page.keyboard.up('KeyJ'); await frames(3);
    caught = await G(() => Object.values(window.__game.fishing.records).reduce((a, r) => a + r.count, 0));
    await close();
  }
  const fishInInv = await G(() => window.__game.inv.list().filter((i) => i.startsWith('fish_')).length);
  check('T4 낚시 → 물고기 획득', caught >= 1, `canFish=${canFish}, caught=${caught}`);
  check('T4 도감·인벤토리 기록', fishInInv >= 1 && await G(() => Object.keys(window.__game.codex.seen).some((k) => k.startsWith('fish:'))));
  // ---- T3 region unlock: bombs open the grove; guardian -> forest wind stone + bow ----
  await G(() => { const g = window.__game; g.inv.add('bomb', 3); g.inv.wear('bomb'); });
  await tp(-58, -16.2, Math.PI); await frames(3); await page.keyboard.press('KeyQ'); await frames(70);
  const opened = await G(() => window.__game.explore.cracked.has('cr_grove'));
  check('T3 폭탄으로 금 간 바위벽 파괴', opened);
  await tp(-58, -17.5, Math.PI); await frames(3);
  const gl = await G(() => window.__game.interactTarget?.label); await page.keyboard.press('KeyE'); await frames(50);
  check('T3 새 지역(숲 공터) 진입', (await G(() => window.__game.area)) === 'grove', gl);
  await frames(30); await shot('e_grove');
  await G(() => { const g = window.__game; const b = g.enemies.find((e) => e.type === 'guardian'); b.set('stun'); b.damage(99, g.player.pos); });
  await frames(120);
  await G(() => { const g = window.__game; for (const k of g.pickups) if (k.big) g.player.place(k.pos.x, k.pos.z, 0); }); await frames(8); await close();
  await G(() => { const g = window.__game; for (const k of g.pickups) if (k.big) g.player.place(k.pos.x, k.pos.z, 0); }); await frames(8); await close();
  check('T3/T7 보스 처치 → 바람돌·활 획득', (await inv('windForest')) === 1 && (await inv('bow')) === 1);
  // ---- shop & upgrade ----
  await G(() => { const g = window.__game; g.transitionTo('island', -3.5, 34.8, Math.PI); }); await frames(60);
  await G(() => { const g = window.__game; g.inv.add('shell', 300); g.inv.add('ore', 2); g.inv.add('fish_carp', 1); g.player.place(-3.5, 34.8, Math.PI); });
  await frames(3); await page.keyboard.press('KeyE'); await frames(3); await choose(0); await frames(3);
  const shell0 = await inv('shell');
  await page.click('[data-buy=bomb]'); await frames(2);
  check('상점 구매 (폭탄)', (await inv('shell')) === shell0 - 6);
  await page.click('[data-stab=sell]'); await frames(2); await page.click('[data-sell=fish_carp]'); await frames(2);
  check('상점 판매 (붕어)', (await inv('fish_carp')) === 0 && (await inv('shell')) > shell0 - 6);
  await page.click('[data-stab=up]'); await frames(2); await page.click('[data-up=sword]'); await frames(2);
  check('장비 강화 (검 +1)', await G(() => window.__game.inv.upgrades.sword === 1 && window.__game.inv.weaponDmg() >= 2));
  await shot('e_shop'); await page.click('[data-m=close]'); await frames(2);
  // ---- minigame: archery ----
  await tp(12, 44.2, Math.PI); await frames(3); await page.keyboard.press('KeyE'); await frames(3); await choose(0); await frames(6);
  const mgActive = await G(() => window.__game.minigames.active);
  for (let i = 0; i < 6; i++) { await page.keyboard.press('KeyQ'); await frames(10); }
  await G(() => { window.__game.minigames['left'] = 0.01; }); await frames(6);
  await shot('e_archery');
  check('미니게임 (활쏘기) 진행·결과', mgActive === 'archery' && await G(() => window.__game.ui.resultOpen && window.__game.minigames.records.archery !== undefined), `score=${await G(() => window.__game.minigames.records.archery)}`);
  await close();
  // ---- time & weather ----
  await G(() => { const g = window.__game; g.time_.hour = 22; g.time_.setWeather('rain', 2); g.player.inv = 999; }); await frames(40);
  await shot('e_night_rain');
  check('밤·비 적용', await G(() => window.__game.time_.isNight && window.__game.time_.weather === 'rain' && window.__game.world.sun.intensity < 1));
  await G(() => { const g = window.__game; g.time_.hour = 9; g.time_.setWeather('clear', 4); g.player.hp = g.player.maxHp; g.player.inv = 0; for (const e of g.enemies) if (e.type === 'moth') e.damage(99, e.pos); }); await frames(10);
  // ---- mount ----
  await G(() => { const g = window.__game; g.quest.set('wolfFriend'); }); await frames(4);
  await page.keyboard.press('KeyG'); await frames(4);
  const z0 = await G(() => window.__game.player.pos.z); await page.keyboard.down('KeyW'); await frames(20); await page.keyboard.up('KeyW'); const z1 = await G(() => window.__game.player.pos.z);
  check('탈것(늑대) 탑승·이동', await G(() => window.__game.mount.riding), `moved ${Math.abs(z1 - z0).toFixed(1)}`);
  await shot('e_ride');
  await page.keyboard.press('KeyG'); await frames(3);
  // ---- map / codex / quest log ----
  await page.keyboard.press('KeyM'); await frames(4); await shot('e_map');
  check('지도 열기 (탐험한 곳만 표시)', await G(() => window.__game.ui.panelOpen === 'hub' && !!document.querySelector('.bigmap')));
  await page.click('[data-m=codex]'); await frames(3); await shot('e_codex');
  check('도감 수집률 표시', await G(() => /수집률/.test(document.querySelector('.panel').textContent)));
  await page.click('[data-m=quests]'); await frames(3);
  check('퀘스트 목록 (메인/일반 구분)', await G(() => document.querySelectorAll('.qcard.main').length > 0 && document.querySelectorAll('.qcard:not(.main)').length > 0));
  await page.click('[data-m=close]'); await frames(2);
  // ---- T8 save & reload ----
  await G(() => window.__game.save());
  const before = await G(() => JSON.stringify({ inv: window.__game.inv.counts.shovel, q: window.__game.qm.state.s_boat, fish: Object.keys(window.__game.fishing.records).length, cracked: window.__game.explore.cracked.size, up: window.__game.inv.upgrades.sword }));
  await page.reload(); await page.waitForFunction(() => (window.__frames || 0) > 3, null, { timeout: 600000 });
  await page.click('[data-m=continue]'); await frames(8);
  const after = await G(() => JSON.stringify({ inv: window.__game.inv.counts.shovel, q: window.__game.qm.state.s_boat, fish: Object.keys(window.__game.fishing.records).length, cracked: window.__game.explore.cracked.size, up: window.__game.inv.upgrades.sword }));
  check('T8 저장 → 재실행 → 복원', before === after, after);
  console.log('SUMMARY ' + results.filter((r) => r.startsWith('PASS')).length + '/' + results.length);
} };
