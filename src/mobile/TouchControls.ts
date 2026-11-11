import { Input, Action } from '../core/Input';

/** Virtual joystick + action buttons + one-finger camera drag + two-finger pinch zoom. */
export class TouchControls {
  root: HTMLDivElement; private stickEl: HTMLDivElement; private knob: HTMLElement; actBtn: HTMLElement;
  private stickId: number | null = null; private camTouches = new Map<number, { x: number; y: number }>(); private pinch = 0;
  enabled = false;
  constructor(private input: Input, parent: HTMLElement, private canvas: HTMLElement) {
    this.root = document.createElement('div'); this.root.className = 'touch';
    this.root.innerHTML = `<div class="stick"><i></i></div>
      <div class="tbtns">
        <div class="tb big" data-a="attack">공격</div>
        <div class="tb jump" data-a="jump">점프</div>
        <div class="tb roll" data-a="roll">구르기</div>
        <div class="tb guard" data-a="guard">방어</div>
        <div class="tb tool" data-a="tool">도구</div>
        <div class="tb act" data-a="interact">조사</div>
      </div>`;
    parent.prepend(this.root);
    this.stickEl = this.root.querySelector('.stick')!; this.knob = this.stickEl.querySelector('i')!;
    this.actBtn = this.root.querySelector('.act')!;
    const center = () => { const r = this.stickEl.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 }; };
    const moveStick = (e: PointerEvent) => {
      const c = center(); let dx = e.clientX - c.x, dy = e.clientY - c.y;
      const l = Math.hypot(dx, dy), max = c.r * 0.75;
      if (l > max) { dx = dx / l * max; dy = dy / l * max; }
      this.knob.style.transform = `translate(${dx}px,${dy}px)`;
      const nx = dx / max, ny = dy / max, m = Math.hypot(nx, ny);
      const dz = 0.12; const k = m < dz ? 0 : (m - dz) / (1 - dz) / (m || 1);
      input.stick.x = nx * k; input.stick.y = ny * k; input.stick.active = true;
    };
    this.stickEl.addEventListener('pointerdown', (e) => { this.stickId = e.pointerId; this.stickEl.setPointerCapture(e.pointerId); moveStick(e); this.use(); e.preventDefault(); });
    this.stickEl.addEventListener('pointermove', (e) => { if (e.pointerId === this.stickId) moveStick(e); });
    const endStick = (e: PointerEvent) => { if (e.pointerId !== this.stickId) return; this.stickId = null; input.stick.active = false; input.stick.x = input.stick.y = 0; this.knob.style.transform = ''; };
    this.stickEl.addEventListener('pointerup', endStick); this.stickEl.addEventListener('pointercancel', endStick);
    this.root.querySelectorAll<HTMLElement>('.tb').forEach((b) => {
      const a = b.dataset.a as Action;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('down'); input.press(a); input.touchHeld.add(a); this.use(); if (navigator.vibrate) try { navigator.vibrate(8); } catch { /* */ } });
      const up = () => { b.classList.remove('down'); input.touchHeld.delete(a); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
    });
    // camera drag / pinch on the canvas
    canvas.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch') return; this.camTouches.set(e.pointerId, { x: e.clientX, y: e.clientY }); this.use(); if (this.camTouches.size === 2) this.pinch = this.pinchDist(); });
    canvas.addEventListener('pointermove', (e) => {
      const p = this.camTouches.get(e.pointerId); if (!p) return;
      if (this.camTouches.size === 1) { input.look.dx += (e.clientX - p.x) * 1.4; input.look.dy += (e.clientY - p.y) * 1.4; }
      p.x = e.clientX; p.y = e.clientY;
      if (this.camTouches.size === 2) { const d = this.pinchDist(); input.look.zoom += (this.pinch - d) * 0.02; this.pinch = d; }
    });
    const endCam = (e: PointerEvent) => { this.camTouches.delete(e.pointerId); };
    canvas.addEventListener('pointerup', endCam); canvas.addEventListener('pointercancel', endCam);
    if (matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window) this.use();
  }
  private pinchDist() { const a = [...this.camTouches.values()]; return a.length < 2 ? 0 : Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); }
  use() { if (this.enabled) return; this.enabled = true; this.input.usingTouch = true; this.root.classList.add('on'); }
  setVisible(v: boolean) { this.root.style.visibility = v ? '' : 'hidden'; }
  setActLabel(t: string | null) { this.actBtn.textContent = t ?? '조사'; this.actBtn.style.opacity = t ? '1' : '0.55'; }
}
