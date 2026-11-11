import { events } from '../core/Events';
import { ITEMS } from '../item/Items';

/** Item ownership, counts and equipment. Emits 'inventory' whenever something changes. */
export class Inventory {
  counts: Record<string, number> = {};
  equipped = { weapon: '' as string, shield: '' as string, tool: '' as string, armor: '' as string };
  maxHearts = 3;
  has(id: string) { return (this.counts[id] ?? 0) > 0; }
  count(id: string) { return this.counts[id] ?? 0; }
  add(id: string, n = 1) {
    const def = ITEMS[id];
    if (id === 'heartContainer') { this.maxHearts++; events.emit('maxHearts', this.maxHearts); events.emit('inventory'); return; }
    this.counts[id] = (this.counts[id] ?? 0) + n;
    if (def?.kind === 'weapon' && !this.equipped.weapon) this.equipped.weapon = id;
    if (def?.kind === 'shield' && !this.equipped.shield) this.equipped.shield = id;
    if (def?.kind === 'tool' && !this.equipped.tool) this.equipped.tool = id;
    if (def?.kind === 'armor' && !this.equipped.armor) this.equipped.armor = id;
    events.emit('inventory');
  }
  take(id: string, n = 1) { if (this.count(id) < n) return false; this.counts[id] -= n; events.emit('inventory'); return true; }
  equip(id: string) {
    const def = ITEMS[id]; if (!def || !this.has(id)) return;
    if (def.kind === 'weapon') this.equipped.weapon = this.equipped.weapon === id ? '' : id;
    else if (def.kind === 'shield') this.equipped.shield = this.equipped.shield === id ? '' : id;
    else if (def.kind === 'tool') this.equipped.tool = this.equipped.tool === id ? '' : id;
    else if (def.kind === 'armor') this.equipped.armor = this.equipped.armor === id ? '' : id;
    events.emit('inventory');
  }
  /** equip without toggling off (used right after buying) */
  wear(id: string) { const k = ITEMS[id]?.kind as keyof Inventory['equipped']; if (k in this.equipped) { (this.equipped as any)[k] = id; events.emit('inventory'); } }
  armorHearts() { return ITEMS[this.equipped.armor]?.hearts ?? 0; }
  weaponDmg() { return ITEMS[this.equipped.weapon]?.dmg ?? 1; }
  weaponReach() { return ITEMS[this.equipped.weapon]?.reach ?? 0; }
  list() { return Object.keys(this.counts).filter((k) => this.counts[k] > 0 && k !== 'shell'); }
  toJSON() { return { counts: this.counts, equipped: this.equipped, maxHearts: this.maxHearts }; }
  load(d: any) { this.counts = { ...(d?.counts ?? {}) }; this.equipped = { weapon: '', shield: '', tool: '', armor: '', ...(d?.equipped ?? {}) }; this.maxHearts = d?.maxHearts ?? 3; events.emit('inventory'); }
}
