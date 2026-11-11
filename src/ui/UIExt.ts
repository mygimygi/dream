import { UI } from './UI';
import { ITEMS } from '../item/Items';
import { Inventory } from '../inventory/Inventory';
import type { Cooking } from '../systems/Cooking';
import { RECIPES, FISH, FishDef } from '../data/itemsData';
import { Codex, CODEX_CATS, CodexCat, MONSTERS, SECRET_PLACES } from '../systems/Codex';
import { REGION_NAMES } from '../world/Heightfield';
import type { QuestManager } from '../systems/Quests';
import { QUESTS } from '../data/quests';
import { RARITY_NAMES } from '../systems/Fishing';

/** UI for the adventure expansion, layered on the base UI (same toy-like style). */
export class UIExt extends UI {
  private extra: Record<string, HTMLElement> = {};
  onMapTeleport?: (i: number) => void;
  constructor() {
    super();
    const add = (k: string, cls: string, html = '') => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; d.hidden = true; this.root.appendChild(d); this.extra[k] = d; return d; };
    add('clock', 'clock-chip'); this.extra.clock.hidden = false;
    add('buffs', 'buff-row'); this.extra.buffs.hidden = false;
    add('tracker', 'tracker');
    add('banner', 'q-banner');
    add('fish', 'fish-ui pe');
    add('mg', 'mg-hud');
    add('result', 'panel-wrap pe');
    // reuse the quest card for the tracker (hide the old single-objective card)
    this.el.quest.hidden = true;
    this.root.querySelector('.hud-top')!.appendChild(this.extra.tracker);
    this.root.querySelector('.hud-top')!.appendChild(this.extra.buffs);
    this.root.querySelector('.hud-right')!.prepend(this.extra.clock);
    const menuBtn = document.createElement('button'); menuBtn.className = 'rbtn pe'; menuBtn.setAttribute('aria-label', '지도'); menuBtn.textContent = '🗺';
    menuBtn.addEventListener('click', () => { this.sfx('ui'); this.onMenu?.('map'); });
    this.root.querySelector('.iconbtns')!.prepend(menuBtn);
  }
  setHudVisible(v: boolean) { for (const k of ['clock', 'buffs', 'tracker']) this.extra[k].style.visibility = v ? '' : 'hidden'; }
  clock(text: string) { if (this.extra.clock.textContent !== text) this.extra.clock.textContent = text; }
  buffs(list: { name: string; left: number }[]) {
    const h = list.map((b) => `<span>${b.name} · ${Math.ceil(b.left)}초</span>`).join('');
    if (this.extra.buffs.innerHTML !== h) this.extra.buffs.innerHTML = h;
  }
  tracker(qm: QuestManager) {
    const main = qm.activeMain(); const side = qm.activeSide();
    const pin = side.find((q) => q.id === qm.tracked) ?? side[0];
    const row = (q: typeof QUESTS[number], kind: string) => `<div class="tq ${kind}"><b>${kind === 'main' ? '★ ' : '◇ '}${q.title}</b>${qm.describe(q).map((o) => `<span class="${o.done ? 'ok' : ''}">${o.done ? '✓' : '·'} ${o.label}${o.b > 1 ? ` (${o.a}/${o.b})` : ''}</span>`).join('')}${qm.state[q.id] === 'complete' ? `<span class="ok">→ ${q.npc}에게 보고하기</span>` : ''}</div>`;
    const h = (main ? row(main, 'main') : '<div class="tq main"><b>★ 섬을 자유롭게 탐험하기</b><span>도감을 채우고 숨은 보물을 찾아보세요</span></div>') + (pin ? row(pin, 'side') : '') + (side.length > 1 ? `<div class="tq more">일반 퀘스트 ${side.length}개 진행 중</div>` : '');
    if (this.extra.tracker.innerHTML !== h) this.extra.tracker.innerHTML = h;
    this.extra.tracker.hidden = false;
  }
  private bannerT = 0;
  questBanner(kind: string, title: string) {
    const b = this.extra.banner; b.innerHTML = `<small>${kind}</small>${title}`; b.hidden = false; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    clearTimeout(this.bannerT); this.bannerT = window.setTimeout(() => { b.hidden = true; }, 3200);
    this.sfx('solve');
  }
  // ---------------------------------------------------------------- fishing
  fishing(s: { phase: 'bite' } | { phase: 'reel'; zone: number; zoneSize: number; fish: number; prog: number; inZone: boolean } | null) {
    const el = this.extra.fish;
    if (!s) { el.hidden = true; return; }
    el.hidden = false;
    if (s.phase === 'bite') { el.innerHTML = `<div class="bite">입질!<small>지금 공격 버튼!</small></div>`; return; }
    if (!el.querySelector('.reel')) el.innerHTML = `<div class="reel"><div class="track"><i class="zone"></i><i class="fishdot">🐟</i></div><div class="prog"><i></i></div><small>공격 버튼을 누르고 있으면 초록 칸이 올라가요</small></div>`;
    const tr = el.querySelector('.track') as HTMLElement, z = el.querySelector('.zone') as HTMLElement, f = el.querySelector('.fishdot') as HTMLElement, p = el.querySelector('.prog i') as HTMLElement;
    z.style.bottom = `${s.zone * 100}%`; z.style.height = `${s.zoneSize * 100}%`; z.classList.toggle('in', s.inZone);
    f.style.bottom = `calc(${s.fish * 100}% - 12px)`;
    p.style.height = `${Math.max(0, Math.min(1, s.prog)) * 100}%`;
    void tr;
  }
  fishResult(f: FishDef, size: number, record: boolean) {
    this.result('낚시', `${f.name} 낚았다!`, `${size}cm · ${RARITY_NAMES[f.rarity]} · 판매가 ${f.price}조개${record ? ' · 최대 크기 기록!' : ''}`, [], f.id);
  }
  // ---------------------------------------------------------------- minigames
  minigameHud(title: string | null, text: string | null) {
    const el = this.extra.mg;
    if (text === null) { el.hidden = true; return; }
    el.hidden = false;
    if (title) el.dataset.title = title;
    el.innerHTML = `<b>${el.dataset.title ?? ''}</b>${text}`;
  }
  result(name: string, title: string, detail: string, rewards: string[], icon?: string) {
    const el = this.extra.result; el.hidden = false;
    el.innerHTML = `<div class="panel result"><small>${name}</small>${icon ? `<img src="${this.icons[icon]}" alt="">` : ''}<h2>${title}</h2><p>${detail}</p>${rewards.length ? `<p class="rw">보상: ${rewards.join(', ')}</p>` : ''}<button class="btn primary" data-x="ok">확인</button></div>`;
    el.querySelector('[data-x=ok]')!.addEventListener('click', () => { this.sfx('ui'); el.hidden = true; });
  }
  get resultOpen() { return !this.extra.result.hidden; }
  closeResult() { this.extra.result.hidden = true; }
  // ---------------------------------------------------------------- game menu hub
  hub(active: string, body: string) {
    const tabs = [['inventory', '가방'], ['map', '지도'], ['quests', '퀘스트'], ['codex', '도감'], ['recipes', '요리책'], ['pause', '설정·저장']];
    this.panel('hub', `<div class="hub-tabs">${tabs.map(([k, l]) => `<button class="chip ${k === active ? 'sel' : ''}" data-m="${k}">${l}</button>`).join('')}<button class="btn x" data-m="close">닫기</button></div>${body}`);
  }
  inventory2(inv: Inventory, stats: { shells: number; time: string; hp: number; max: number }, onAct: (id: string, act: string) => void, tab = 'gear') {
    const render = () => {
      const ids = inv.list().filter((id) => Inventory.TABS.find((t) => t.id === tab)!.kinds.includes(ITEMS[id]?.kind as string));
      const eqd = (id: string) => Object.values(inv.equipped).includes(id);
      this.hub('inventory', `<div class="stats"><span>❤ ${stats.hp / 2} / ${stats.max / 2}</span><span>반짝 조개 ${stats.shells}</span><span>하트 조각 ${inv.count('heartPiece')}/4</span><span>검 강화 +${inv.upgrades.sword ?? 0}</span><span>플레이 ${stats.time}</span></div>
        <div class="hub-tabs sub">${Inventory.TABS.map((t) => `<button class="chip ${t.id === tab ? 'sel' : ''}" data-tab="${t.id}">${t.label}</button>`).join('')}</div>
        <div class="grid inv2">${ids.length ? ids.map((id) => `<button class="slot" data-id="${id}" aria-label="${ITEMS[id].name}"><img src="${this.icons[id]}" alt="">${eqd(id) ? '<span class="eq">장착</span>' : ''}${ITEMS[id].stack ? `<span class="n">${inv.count(id)}</span>` : ''}</button>`).join('') : '<p>이 칸은 비어 있어요.</p>'}</div>
        <div class="detail" data-k="det"><p>아이템을 고르면 설명과 사용법이 나와요.</p></div>`);
      this.el.panelBody.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab!; this.sfx('ui'); render(); }));
      this.el.panelBody.querySelectorAll<HTMLElement>('.slot').forEach((b) => b.addEventListener('click', () => {
        const id = b.dataset.id!, d = ITEMS[id] as any; this.sfx('ui');
        this.el.panelBody.querySelectorAll('.slot').forEach((x) => x.classList.remove('sel')); b.classList.add('sel');
        const acts: string[] = [];
        if (['weapon', 'shield', 'tool', 'armor'].includes(d.kind) && id !== 'arrow') acts.push(`<button class="btn primary" data-a="equip">${eqd(id) ? '장착 해제' : '장착하기'}</button>`);
        if (d.kind === 'food' || id === 'berry') acts.push(`<button class="btn teal" data-a="eat">먹기</button>`);
        const det = this.el.panelBody.querySelector('[data-k=det]') as HTMLElement;
        det.innerHTML = `<img src="${this.icons[id]}" alt=""><h3>${d.name}</h3><p>${d.desc}</p>${d.price ? `<span class="tag">판매가 ${Math.max(1, Math.floor(d.price * 0.6))}조개</span>` : ''}<div class="choices">${acts.join('')}</div>`;
        det.querySelectorAll<HTMLElement>('[data-a]').forEach((x) => x.addEventListener('click', () => { onAct(id, x.dataset.a!); render(); }));
      }));
    };
    render();
  }
  questLog(qm: QuestManager) {
    const st: Record<string, string> = { available: '진행 가능', active: '진행 중', complete: '보고 대기', rewarded: '완료' };
    const card = (q: typeof QUESTS[number]) => { const s = qm.state[q.id]; return `<div class="qcard ${q.main ? 'main' : ''} ${s}"><div class="qh"><b>${q.main ? '★' : '◇'} ${q.title}</b><span class="tag">${st[s]}</span></div><p>${q.desc}</p>${s !== 'rewarded' ? qm.describe(q).map((o) => `<span class="${o.done ? 'ok' : ''}">${o.done ? '✓' : '·'} ${o.label}${o.b > 1 ? ` (${o.a}/${o.b})` : ''}</span>`).join('') : ''}${q.npc ? `<small>의뢰: ${q.npc}</small>` : ''}${!q.main && (s === 'active' || s === 'complete') ? `<button class="chip" data-track="${q.id}">${qm.tracked === q.id ? '추적 중' : '화면에 추적'}</button>` : ''}</div>`; };
    const vis = QUESTS.filter((q) => qm.state[q.id] !== 'hidden');
    this.hub('quests', `<h3 class="sec">메인 스토리</h3>${vis.filter((q) => q.main).map(card).join('')}<h3 class="sec">일반 퀘스트</h3>${vis.filter((q) => !q.main).map(card).join('') || '<p>마을 사람들 머리 위 <b>!</b> 표시를 찾아 말을 걸어 보세요.</p>'}`);
    this.el.panelBody.querySelectorAll<HTMLElement>('[data-track]').forEach((b) => b.addEventListener('click', () => { qm.tracked = b.dataset.track!; this.questLog(qm); }));
  }
  codexView(cx: Codex, cat: CodexCat = 'fish', records?: Record<string, { count: number; max: number }>) {
    const all = Codex.all()[cat];
    const name = (id: string) => cat === 'monsters' ? MONSTERS[id].name : cat === 'places' ? (REGION_NAMES as any)[id] ?? SECRET_PLACES[id] : ITEMS[id]?.name ?? id;
    const desc = (id: string) => cat === 'monsters' ? MONSTERS[id].desc : cat === 'places' ? '탐험으로 발견한 장소' : ITEMS[id]?.desc ?? '';
    const icon = (id: string) => cat === 'monsters' ? `<span class="mon" style="background:${MONSTERS[id].color}"></span>` : cat === 'places' ? `<span class="mon place">⛰</span>` : `<img src="${this.icons[id]}" alt="">`;
    const tot = cx.stats();
    this.hub('codex', `<div class="stats"><span>전체 수집률 ${tot.pct}% (${tot.a}/${tot.b})</span></div>
      <div class="hub-tabs sub">${CODEX_CATS.map((c) => { const s = cx.stats(c.id); return `<button class="chip ${c.id === cat ? 'sel' : ''}" data-cat="${c.id}">${c.label} ${s.a}/${s.b}</button>`; }).join('')}</div>
      <div class="codex">${all.map((id) => { const seen = cx.has(cat, id); const rec = seen ? cx.seen[`${cat}:${id}`] : null; const fr = cat === 'fish' && records?.[id];
        return `<div class="centry ${seen ? '' : 'unknown'}">${icon(id)}<b>${seen ? name(id) : '???'}</b>${seen ? `<p>${desc(id)}</p><small>#${rec!.order}${rec!.where ? ` · ${rec!.where}` : ''}${fr ? ` · ${fr.count}마리, 최대 ${fr.max}cm` : ''}</small>` : '<p>아직 발견하지 못했어요</p>'}</div>`; }).join('')}</div>`);
    this.el.panelBody.querySelectorAll<HTMLElement>('[data-cat]').forEach((b) => b.addEventListener('click', () => { this.sfx('ui'); this.codexView(cx, b.dataset.cat as CodexCat, records); }));
  }
  recipes(known: Set<string>) {
    this.hub('recipes', `<div class="codex">${RECIPES.map((r) => { const k = known.has(r.id); return `<div class="centry ${k ? '' : 'unknown'}"><img src="${this.icons[r.out]}" alt=""><b>${k ? ITEMS[r.out].name : '???'}</b><p>${k ? r.ingredients.map((i) => i === 'fish' ? '물고기' : ITEMS[i].name).join(' + ') : '재료 조합을 직접 찾아보세요'}</p>${k ? `<small>${ITEMS[r.out].desc}</small>` : ''}</div>`; }).join('')}</div><p class="hint">팁: 요리 냄비에서 재료 2~3개를 골라요. 물고기는 종류와 상관없이 '물고기'로 쳐요.</p>`);
  }
  cooking(c: Cooking) {
    const sel: string[] = [];
    const render = (made?: string) => {
      const ing = c.ingredients();
      this.panel('cook', `<h2>요리 냄비 <button class="btn x" data-m="close">닫기</button></h2>
        <div class="stats"><span>재료를 2~3개 골라요 (같은 재료를 여러 번 골라도 돼요)</span></div>
        <div class="grid">${ing.map((id) => { const used = sel.filter((x) => x === id).length; return `<button class="slot ${used ? 'sel' : ''}" data-id="${id}" ${c['g'].inv.count(id) - used <= 0 ? 'disabled' : ''}><img src="${this.icons[id]}" alt=""><span class="n">${c['g'].inv.count(id) - used}</span></button>`; }).join('')}</div>
        <div class="pot-row">${[0, 1, 2].map((i) => sel[i] ? `<button class="slot sel" data-rm="${i}"><img src="${this.icons[sel[i]]}" alt=""></button>` : '<div class="slot empty"></div>').join('')}<button class="btn primary" data-cook ${sel.length < 2 ? 'disabled' : ''}>요리하기</button></div>
        ${made ? `<div class="made"><img src="${this.icons[made]}" alt=""><b>${ITEMS[made].name}</b> 완성! <small>${ITEMS[made].desc}</small></div>` : ''}`);
      this.el.panelBody.querySelectorAll<HTMLElement>('[data-id]').forEach((b) => b.addEventListener('click', () => { if (sel.length < 3) { sel.push(b.dataset.id!); this.sfx('ui'); render(); } }));
      this.el.panelBody.querySelectorAll<HTMLElement>('[data-rm]').forEach((b) => b.addEventListener('click', () => { sel.splice(+b.dataset.rm!, 1); render(); }));
      this.el.panelBody.querySelector('[data-cook]')?.addEventListener('click', () => { const out = c.cook(sel.slice()); sel.length = 0; render(out ?? undefined); });
    };
    render();
  }
  map(opts: { draw: (cv: HTMLCanvasElement) => void; owls: { i: number; name: string; active: boolean }[]; legend: string }) {
    this.hub('map', `<div class="map-wrap"><canvas class="bigmap" width="640" height="640"></canvas></div><div class="legend2">${opts.legend}</div>
      <div class="owls">${opts.owls.map((o) => `<button class="chip" data-owl="${o.i}" ${o.active ? '' : 'disabled'}>🦉 ${o.active ? o.name : '???'}</button>`).join('')}</div>`);
    opts.draw(this.el.panelBody.querySelector('.bigmap') as HTMLCanvasElement);
    this.el.panelBody.querySelectorAll<HTMLElement>('[data-owl]').forEach((b) => b.addEventListener('click', () => this.onMapTeleport?.(+b.dataset.owl!)));
  }
  shop2(opts: { buy: { id: string; price: number; currency: string; owned: boolean; afford: boolean; equipped: boolean }[]; sell: { id: string; n: number; price: number }[]; upgrades: { key: string; label: string; level: number; cost: string; can: boolean; max: boolean }[]; wallet: { shell: number; berry: number } },
    onBuy: (id: string) => void, onSell: (id: string, all: boolean) => void, onUp: (k: string) => void, tab = 'buy') {
    const cur = (c: string) => `<img src="${this.icons[c === 'shell' ? 'shell' : 'berry']}" alt="">`;
    const body = tab === 'buy'
      ? opts.buy.map((it) => { const d = ITEMS[it.id]; return `<div class="sitem ${it.owned ? 'owned' : ''}"><img src="${this.icons[it.id]}" alt=""><div class="sbody"><b>${d.name}</b><p>${d.desc}</p></div><button class="btn ${it.owned ? '' : 'primary'}" data-buy="${it.id}" ${it.owned || !it.afford ? 'disabled' : ''}>${it.owned ? (it.equipped ? '장착 중' : '보유') : `${cur(it.currency)} ${it.price}`}</button></div>`; }).join('')
      : tab === 'sell'
        ? (opts.sell.length ? opts.sell.map((it) => `<div class="sitem"><img src="${this.icons[it.id]}" alt=""><div class="sbody"><b>${ITEMS[it.id].name} ×${it.n}</b><p>개당 ${it.price}조개</p></div><div class="choices"><button class="btn primary" data-sell="${it.id}">1개 팔기</button><button class="btn" data-sellall="${it.id}">모두</button></div></div>`).join('') : '<p>팔 수 있는 물건(물고기, 재료, 보물)이 없어요.</p>')
        : opts.upgrades.map((u) => `<div class="sitem"><div class="sbody"><b>${u.label} +${u.level}</b><p>${u.max ? '최대 단계예요' : `다음 단계 비용: ${u.cost}`}</p></div><button class="btn primary" data-up="${u.key}" ${u.can && !u.max ? '' : 'disabled'}>강화</button></div>`).join('');
    this.panel('shop', `<h2>바위네 대장간 <button class="btn x" data-m="close">닫기</button></h2>
      <div class="stats"><span class="wallet">${cur('shell')} ${opts.wallet.shell}</span><span class="wallet">${cur('berry')} ${opts.wallet.berry}</span></div>
      <div class="hub-tabs sub">${[['buy', '사기'], ['sell', '팔기'], ['up', '장비 강화']].map(([k, l]) => `<button class="chip ${k === tab ? 'sel' : ''}" data-stab="${k}">${l}</button>`).join('')}</div><div class="shop">${body}</div>`);
    const q = (sel: string, fn: (b: HTMLElement) => void) => this.el.panelBody.querySelectorAll<HTMLElement>(sel).forEach((b) => b.addEventListener('click', () => fn(b)));
    q('[data-stab]', (b) => { this.sfx('ui'); this.shop2(opts, onBuy, onSell, onUp, b.dataset.stab); });
    q('[data-buy]', (b) => onBuy(b.dataset.buy!)); q('[data-sell]', (b) => onSell(b.dataset.sell!, false)); q('[data-sellall]', (b) => onSell(b.dataset.sellall!, true)); q('[data-up]', (b) => onUp(b.dataset.up!));
  }
}
export { FISH };
