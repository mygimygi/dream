import type { Game } from '../core/Game';
import { BUFFS, RECIPES } from '../data/itemsData';
import { ITEMS } from '../item/Items';
import { events } from '../core/Events';

const INGREDIENT_KINDS = ['material', 'fish'];
export interface Buff { id: string; name: string; left: number; speed?: number; defense?: number; hearts?: number; }

/** Cooking pots + recipe book + timed food buffs (max 2 at once). */
export class Cooking {
  known = new Set<string>();      // recipe ids discovered
  buffs: Buff[] = [];
  constructor(private g: Game) {}
  private tag(id: string) { return id.startsWith('fish_') ? 'fish' : id; }
  ingredients() { return this.g.inv.list().filter((id) => INGREDIENT_KINDS.includes(ITEMS[id]?.kind as string) || id === 'berry').filter((id) => id !== 'ore'); }
  open() {
    if (!this.ingredients().length) { this.g.say([{ who: '', text: '냄비가 보글보글 끓고 있다. 요리할 재료가 없다. 버섯, 사과, 채소, 물고기를 모아 오자.' }]); return; }
    this.g.ui.cooking(this);
  }
  /** Cook with selected item ids (2-3). Returns produced dish id. */
  cook(sel: string[]): string | null {
    if (sel.length < 2 || sel.length > 3) return null;
    const counts: Record<string, number> = {};
    for (const s of sel) counts[s] = (counts[s] ?? 0) + 1;
    for (const [id, n] of Object.entries(counts)) if (this.g.inv.count(id) < n) return null;
    for (const [id, n] of Object.entries(counts)) this.g.inv.take(id, n);
    const tags = sel.map((s) => this.tag(s)).sort().join('+');
    const r = RECIPES.find((x) => x.ingredients.slice().sort().join('+') === tags);
    const out = r?.out ?? 'burnt';
    if (r) this.known.add(r.id);
    this.g.inv.add(out); this.g.codex.see('dishes', out);
    events.emit('cooked', out);
    this.g.audio.play(r ? 'chest' : 'thud');
    return out;
  }
  /** eat a dish: heal + buff */
  eat(id: string) {
    const def = ITEMS[id] as any; if (!def || !this.g.inv.take(id)) return;
    const P = this.g.player;
    P.heal(def.heal ?? 2);
    const b = BUFFS[id];
    if (b) {
      this.buffs = this.buffs.filter((x) => x.id !== id);
      if (this.buffs.length >= 2) this.buffs.shift();
      this.buffs.push({ id, name: b.name, left: b.dur, speed: b.speed, defense: b.defense, hearts: b.hearts });
      if (b.hearts) P.heal(b.hearts * 2);
    }
    this.g.audio.play('heal');
    this.g.ui.toast(`${def.name}을(를) 먹었다${b ? ` · ${b.name}` : ''}`);
  }
  speedMul() { return this.buffs.reduce((m, b) => m * (b.speed ?? 1), 1); }
  defenseMul() { return this.buffs.reduce((m, b) => m * (b.defense ?? 1), 1); }
  extraHearts() { return this.buffs.reduce((m, b) => m + (b.hearts ?? 0), 0); }
  update(dt: number) {
    if (!this.buffs.length) return;
    for (const b of this.buffs) b.left -= dt;
    const expired = this.buffs.filter((b) => b.left <= 0);
    if (expired.length) { this.buffs = this.buffs.filter((b) => b.left > 0); this.g.ui.toast(`${expired.map((b) => b.name).join(', ')} 효과가 끝났다`); const P = this.g.player; if (P.hp > P.maxHp) P.hp = P.maxHp; }
  }
  toJSON() { return { known: [...this.known], buffs: this.buffs }; }
  load(d: any) { this.known = new Set(d?.known ?? []); this.buffs = d?.buffs ?? []; }
}
