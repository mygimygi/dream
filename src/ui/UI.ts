import './style.css';
import { ITEMS } from '../item/Items';
import { Inventory } from '../inventory/Inventory';
import { Line } from '../quest/Quest';
import { Settings } from '../save/Save';

const heartSVG = (fill: number) => {
  // fill: 0, 0.5, 1
  const id = 'h' + Math.random().toString(36).slice(2, 7);
  return `<svg viewBox="0 0 32 30" aria-hidden="true"><defs><clipPath id="${id}"><rect x="0" y="0" width="${16 * fill * 2}" height="30"/></clipPath></defs>
  <path d="M16 28 C8 21 2 16 2 9.5 C2 5 5.5 2 9.5 2 C12.4 2 14.6 3.6 16 6 C17.4 3.6 19.6 2 22.5 2 C26.5 2 30 5 30 9.5 C30 16 24 21 16 28Z" fill="#fff7e8" stroke="#4a3424" stroke-width="2.5"/>
  <path clip-path="url(#${id})" d="M16 28 C8 21 2 16 2 9.5 C2 5 5.5 2 9.5 2 C12.4 2 14.6 3.6 16 6 C17.4 3.6 19.6 2 22.5 2 C26.5 2 30 5 30 9.5 C30 16 24 21 16 28Z" fill="#f0485a" stroke="#4a3424" stroke-width="2.5"/>
  ${fill > 0 ? '<ellipse cx="9.5" cy="8.5" rx="3" ry="2" fill="#fff" opacity=".7"/>' : ''}</svg>`;
};

/** All DOM user interface: HUD, prompts, dialog, item-get banner, inventory, menus, title, credits. */
export class UI {
  root = document.getElementById('ui') as HTMLDivElement;
  icons: Record<string, string> = {};
  private el: Record<string, HTMLElement> = {};
  private dlgQueue: Line[] = []; private dlgDone?: (v?: string) => void; private typing = 0; private typeTimer = 0; private fullText = '';
  dialogOpen = false; panelOpen: string | null = null;
  onChoice?: (v: string) => void;
  onMenu?: (action: string) => void;
  onSettings?: (s: Settings) => void;
  onEquip?: (id: string) => void; onUse?: (id: string) => void;
  sfx: (n: string) => void = () => {};
  constructor() {
    this.root.innerHTML = `
      <div class="hud" data-k="hud" hidden>
        <div class="hud-top"><div class="hearts" data-k="hearts"></div><div class="money" data-k="money"><img alt="" data-k="shellIcon"><span data-k="shells">0</span></div><div class="quest" data-k="quest"><b></b><span></span></div></div>
        <div class="hud-right"><div class="iconbtns"><button class="rbtn pe" data-k="btnFull" aria-label="전체화면">⛶</button><button class="rbtn pe" data-k="btnInv" aria-label="인벤토리">🎒</button><button class="rbtn pe" data-k="btnPause" aria-label="일시정지">Ⅱ</button></div>
          <div class="minimap" data-k="mm"></div><div class="mm-name" data-k="mmName"></div></div>
        <div class="equip" data-k="equip"></div>
        <div class="bossbar" data-k="boss" hidden><b>가시고둥왕</b><div class="bar"><i data-k="bossFill"></i></div></div>
      </div>
      <div class="prompt" data-k="prompt" hidden></div>
      <div class="toast-region" data-k="region"></div>
      <div class="toast" data-k="toast"></div>
      <div class="itemget" data-k="itemget" hidden><img alt="" data-k="igImg"><div><h3 data-k="igName"></h3><p data-k="igDesc"></p></div></div>
      <div class="dialog pe" data-k="dialog" hidden><div class="who" data-k="who"></div><div data-k="dtext"></div><div class="choices" data-k="choices"></div><div class="next" data-k="dnext">▼</div></div>
      <div class="title pe" data-k="title" hidden><div class="logo"><h1>파도섬 이야기</h1><p>바람을 되찾는 작은 섬의 모험</p></div>
        <div class="menu"><button class="btn primary" data-m="new">새 게임</button><button class="btn" data-m="continue">이어하기</button><button class="btn" data-m="settings">설정</button><button class="btn" data-m="help">조작 방법</button></div></div>
      <div class="panel-wrap pe" data-k="panel" hidden><div class="panel" data-k="panelBody"></div></div>
      <div class="credits pe" data-k="credits" hidden></div>
      <div class="fade" data-k="fade"></div>
      <div class="fps" data-k="fps"></div>`;
    this.root.querySelectorAll<HTMLElement>('[data-k]').forEach((e) => (this.el[e.dataset.k!] = e));
    this.root.querySelectorAll<HTMLElement>('[data-m]').forEach((b) => b.addEventListener('click', () => { this.sfx('ui'); this.onMenu?.(b.dataset.m!); }));
    this.el.btnInv.addEventListener('click', () => { this.sfx('ui'); this.onMenu?.('inventory'); });
    this.el.btnPause.addEventListener('click', () => { this.sfx('ui'); this.onMenu?.('pause'); });
    this.el.btnFull.addEventListener('click', () => { this.sfx('ui'); this.onMenu?.('fullscreen'); });
    this.el.dialog.addEventListener('pointerdown', (e) => { if ((e.target as HTMLElement).closest('.btn')) return; this.advance(); });
    this.el.panel.addEventListener('pointerdown', (e) => { if (e.target === this.el.panel) this.onMenu?.('close'); });
  }
  setIcons(icons: Record<string, string>) { this.icons = icons; (this.el.shellIcon as HTMLImageElement).src = icons.shell; }
  minimapCanvas(c: HTMLCanvasElement) { this.el.mm.appendChild(c); }
  show(k: string, v: boolean) { this.el[k].hidden = !v; }
  hearts(hp: number, max: number) {
    let h = '';
    for (let i = 0; i < max / 2; i++) h += heartSVG(Math.max(0, Math.min(1, (hp - i * 2) / 2)));
    if (this.el.hearts.innerHTML !== h) this.el.hearts.innerHTML = h;
  }
  shells(n: number) { this.el.shells.textContent = String(n); }
  quest(title: string, hint: string) { (this.el.quest.querySelector('b')!).textContent = title; (this.el.quest.querySelector('span')!).textContent = hint; }
  areaName(n: string) { this.el.mmName.textContent = n; }
  equip(inv: Inventory, touch: boolean) {
    const s = (id: string, key: string, cnt?: number) => id ? `<div class="eslot"><img src="${this.icons[id]}" alt="${ITEMS[id].name}">${cnt !== undefined ? `<span class="cnt">${cnt}</span>` : ''}${touch ? '' : `<kbd>${key}</kbd>`}</div>` : '';
    this.el.equip.innerHTML = s(inv.equipped.tool, 'Q') + s(inv.equipped.shield, 'L') + s(inv.equipped.weapon, 'J') + (inv.has('smallKey') ? s('smallKey', '', inv.count('smallKey')) : '');
  }
  prompt(text: string | null, touch: boolean) {
    if (!text) { this.el.prompt.hidden = true; return; }
    this.el.prompt.hidden = false;
    this.el.prompt.innerHTML = touch ? `<kbd>조사</kbd>${text}` : `<kbd>E</kbd>${text}`;
  }
  private regionT = 0;
  region(name: string, sub = '') {
    this.el.region.innerHTML = `<small>${sub}</small>${name}`;
    this.el.region.classList.add('show'); clearTimeout(this.regionT);
    this.regionT = window.setTimeout(() => this.el.region.classList.remove('show'), 2600);
  }
  private toastT = 0;
  toast(t: string) { this.el.toast.textContent = t; this.el.toast.classList.add('show'); clearTimeout(this.toastT); this.toastT = window.setTimeout(() => this.el.toast.classList.remove('show'), 2200); }
  itemGet(id: string, count = 1) {
    const d = ITEMS[id];
    (this.el.igImg as HTMLImageElement).src = this.icons[id] ?? '';
    this.el.igName.textContent = d.name + (count > 1 ? ` ×${count}` : '');
    this.el.igDesc.textContent = d.desc;
    this.el.itemget.hidden = false;
  }
  hideItemGet() { this.el.itemget.hidden = true; }
  boss(frac: number | null) { this.el.boss.hidden = frac === null; if (frac !== null) (this.el.bossFill as HTMLElement).style.width = `${Math.max(0, frac) * 100}%`; }
  fade(on: boolean) { this.el.fade.classList.toggle('on', on); }
  fps(t: string) { this.el.fps.textContent = t; }

  // ---------------- dialog ----------------
  dialog(lines: Line[], done?: (v?: string) => void) { this.dlgQueue = lines.slice(); this.dlgDone = done; this.dialogOpen = true; this.el.dialog.hidden = false; this.showLine(); }
  private showLine() {
    const l = this.dlgQueue[0];
    this.el.who.textContent = l.who; this.el.who.hidden = !l.who;
    this.fullText = l.text; this.typing = 0;
    this.el.dtext.textContent = '';
    this.el.choices.innerHTML = '';
    this.el.dnext.hidden = true;
    clearInterval(this.typeTimer);
    this.typeTimer = window.setInterval(() => {
      this.typing++;
      this.el.dtext.textContent = this.fullText.slice(0, this.typing);
      if (this.typing % 3 === 0) this.sfx('talk');
      if (this.typing >= this.fullText.length) this.finishTyping();
    }, 28);
  }
  private finishTyping() {
    clearInterval(this.typeTimer); this.typing = this.fullText.length; this.el.dtext.textContent = this.fullText;
    const l = this.dlgQueue[0];
    if (l.choices) {
      this.el.choices.innerHTML = l.choices.map((c, i) => `<button class="btn ${i === 0 ? 'primary' : ''}" data-v="${c.value}">${c.label}</button>`).join('');
      this.el.choices.querySelectorAll<HTMLElement>('.btn').forEach((b) => b.addEventListener('click', () => { this.sfx('ui'); this.close(b.dataset.v); }));
      (this.el.choices.querySelector('.btn') as HTMLElement)?.focus();
    } else this.el.dnext.hidden = false;
  }
  advance() {
    if (!this.dialogOpen) return;
    if (this.typing < this.fullText.length) { this.finishTyping(); return; }
    if (this.dlgQueue[0]?.choices) return;
    this.dlgQueue.shift();
    if (this.dlgQueue.length) this.showLine(); else this.close();
  }
  private close(v?: string) { clearInterval(this.typeTimer); this.dialogOpen = false; this.el.dialog.hidden = true; const d = this.dlgDone; this.dlgDone = undefined; d?.(v); }

  // ---------------- panels ----------------
  closePanel() { this.el.panel.hidden = true; this.panelOpen = null; }
  private panel(name: string, html: string) { this.panelOpen = name; this.el.panel.hidden = false; this.el.panelBody.innerHTML = html; this.el.panelBody.querySelectorAll<HTMLElement>('[data-m]').forEach((b) => b.addEventListener('click', () => { this.sfx('ui'); this.onMenu?.(b.dataset.m!); })); }
  inventory(inv: Inventory, stats: { shells: number; stars: number; time: string; hp: number; max: number }) {
    const ids = inv.list();
    let sel = ids[0];
    const render = () => {
      const d = sel ? ITEMS[sel] : null;
      const kindName: Record<string, string> = { weapon: '무기', shield: '방패', tool: '특수 도구', consumable: '회복 아이템', upgrade: '강화', key: '열쇠', quest: '퀘스트 아이템', currency: '화폐', treasure: '수집품' };
      const eqd = (id: string) => inv.equipped.weapon === id || inv.equipped.shield === id || inv.equipped.tool === id;
      this.panel('inventory', `<h2>가방 <button class="btn x" data-m="close" aria-label="닫기">닫기</button></h2>
        <div class="stats"><span>❤ ${stats.hp / 2} / ${stats.max / 2}</span><span>반짝 조개 ${stats.shells}</span><span>별 조각 ${stats.stars}</span><span>플레이 ${stats.time}</span></div>
        <div class="inv"><div class="grid">${ids.length ? ids.map((id) => `<button class="slot ${id === sel ? 'sel' : ''}" data-id="${id}" aria-label="${ITEMS[id].name}"><img src="${this.icons[id]}" alt="">${eqd(id) ? '<span class="eq">장착</span>' : ''}${ITEMS[id].stack ? `<span class="n">${inv.count(id)}</span>` : ''}</button>`).join('') : '<p>아직 가방이 비어 있어요.</p>'}</div>
        <div class="detail">${d ? `<img src="${this.icons[d.id]}" alt=""><h3>${d.name}</h3><span class="tag">${kindName[d.kind]}</span><p>${d.desc}</p>
          ${['weapon', 'shield', 'tool'].includes(d.kind) ? `<button class="btn primary" data-act="equip">${eqd(d.id) ? '장착 해제' : '장착하기'}</button>` : ''}
          ${d.kind === 'consumable' ? `<button class="btn teal" data-act="use">사용하기</button>` : ''}` : ''}</div></div>`);
      this.el.panelBody.querySelectorAll<HTMLElement>('.slot').forEach((b) => b.addEventListener('click', () => { sel = b.dataset.id!; this.sfx('ui'); render(); }));
      this.el.panelBody.querySelector('[data-act=equip]')?.addEventListener('click', () => { this.onEquip?.(sel); this.sfx('ui'); render(); });
      this.el.panelBody.querySelector('[data-act=use]')?.addEventListener('click', () => { this.onUse?.(sel); if (!inv.has(sel)) sel = inv.list()[0]; render(); });
    };
    render();
  }
  deadPanel() {
    this.panel('dead', `<h2>쓰러지고 말았어요…</h2><p style="margin:0 0 16px">모은 물건은 그대로 남아 있어요.</p><div class="menu"><button class="btn primary" data-m="retry">다시 일어나기</button><button class="btn" data-m="toTitle">타이틀로</button></div>`);
  }
  setFullscreenState(active: boolean, supported: boolean) {
    this.el.btnFull.hidden = !supported;
    this.el.btnFull.textContent = active ? '🗗' : '⛶';
    this.el.btnFull.setAttribute('aria-label', active ? '전체화면 끄기' : '전체화면');
  }
  pause() {
    this.panel('pause', `<h2>일시정지</h2><div class="menu">
      <button class="btn primary" data-m="close">계속하기</button><button class="btn" data-m="fullscreen">전체화면 켜기/끄기</button><button class="btn" data-m="inventory">가방</button>
      <button class="btn teal" data-m="save">저장하기</button><button class="btn" data-m="settings">설정</button>
      <button class="btn" data-m="help">조작 방법</button><button class="btn" data-m="toTitle">타이틀로</button></div>`);
  }
  settings(s: Settings) {
    this.panel('settings', `<h2>설정 <button class="btn x" data-m="back">뒤로</button></h2>
      <div class="row"><label for="s-q">그래픽 품질</label><select id="s-q"><option value="auto">자동</option><option value="low">낮음</option><option value="medium">중간</option><option value="high">높음</option></select></div>
      <div class="row"><label for="s-m">음악</label><input id="s-m" type="range" min="0" max="1" step="0.05"></div>
      <div class="row"><label for="s-s">효과음</label><input id="s-s" type="range" min="0" max="1" step="0.05"></div>
      <div class="row"><label for="s-c">카메라 감도</label><input id="s-c" type="range" min="0.3" max="2" step="0.1"></div>
      <div class="row"><label for="s-k">화면 흔들림</label><input id="s-k" type="checkbox" style="width:22px;height:22px;accent-color:var(--coral)"></div>`);
    const q = (id: string) => this.el.panelBody.querySelector('#' + id) as HTMLInputElement;
    q('s-q').value = s.quality; q('s-m').value = String(s.music); q('s-s').value = String(s.sfx); q('s-c').value = String(s.sens); q('s-k').checked = s.shake;
    const emit = () => this.onSettings?.({ quality: q('s-q').value as any, music: +q('s-m').value, sfx: +q('s-s').value, sens: +q('s-c').value, shake: q('s-k').checked });
    for (const id of ['s-q', 's-m', 's-s', 's-c', 's-k']) q(id).addEventListener('change', emit);
  }
  help(touch: boolean) {
    this.panel('help', `<h2>조작 방법 <button class="btn x" data-m="back">뒤로</button></h2>
      ${touch ? `<div class="keys"><kbd>왼쪽 원</kbd><span>이동 (끝까지 밀면 달리기)</span><kbd>화면 드래그</kbd><span>카메라 회전</span><kbd>두 손가락</kbd><span>확대 / 축소</span><kbd>공격</kbd><span>검 휘두르기 (연타: 3단 콤보, 공중: 내려찍기)</span><kbd>점프 · 구르기</kbd><span>구르는 동안 무적</span><kbd>방어</kbd><span>누르고 있는 동안 방패로 막기</span><kbd>도구</kbd><span>장착한 도구 사용 (등불: 횃불 점화)</span><kbd>조사</kbd><span>대화 · 상자 · 표지판</span></div>` :
      `<div class="keys"><kbd>WASD / 방향키</kbd><span>이동</span><kbd>Shift</kbd><span>달리기</span><kbd>마우스 오른쪽 드래그</kbd><span>카메라 회전</span><kbd>휠</kbd><span>확대 / 축소</span><kbd>J / 마우스 왼쪽</kbd><span>공격 (연타: 3단 콤보, 공중: 내려찍기)</span><kbd>Space</kbd><span>점프</span><kbd>K</kbd><span>구르기 (무적 시간)</span><kbd>L</kbd><span>방어 (방패 필요)</span><kbd>Q</kbd><span>도구 사용</span><kbd>E / F</kbd><span>조사 · 대화 · 상자 열기</span><kbd>I / Tab</kbd><span>가방</span><kbd>Esc / P</kbd><span>일시정지</span></div>`}
      <p style="margin-top:14px;font-size:14px;color:var(--ink-soft)">무거운 돌은 그쪽으로 계속 걸어가면 밀려요. 진행 상황은 상자를 열거나 지역을 옮길 때 자동 저장돼요.</p>`);
  }
  title(show: boolean, hasSave: boolean) { this.el.title.hidden = !show; (this.el.title.querySelector('[data-m=continue]') as HTMLButtonElement).disabled = !hasSave; if (show) (this.el.title.querySelector('[data-m=' + (hasSave ? 'continue' : 'new') + ']') as HTMLElement).focus(); }
  credits(text: { time: string; stars: number }) {
    this.el.credits.hidden = false;
    this.el.credits.innerHTML = `<div class="card"><h2>바람이 돌아왔어요</h2><p>달진주가 제단에 놓이자 섬 전체에 다시 바람이 불기 시작했어요.<br>갈매기가 날고, 도윤 아저씨의 배도 바다로 나갈 수 있게 되었답니다.</p>
      <p>플레이 시간 ${text.time} · 별 조각 ${text.stars}개</p><div class="menu"><button class="btn primary" data-c="free">계속 탐험하기</button><button class="btn" data-c="title">타이틀로</button></div></div>`;
    this.el.credits.querySelectorAll<HTMLElement>('[data-c]').forEach((b) => b.addEventListener('click', () => { this.el.credits.hidden = true; this.onMenu?.(b.dataset.c === 'free' ? 'free' : 'toTitle'); }));
  }
  get anyModal() { return this.dialogOpen || !!this.panelOpen || !this.el.title.hidden || !this.el.credits.hidden; }
}
