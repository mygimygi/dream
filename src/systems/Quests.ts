import type { Game } from '../core/Game';
import { QUESTS, QuestDef, Objective } from '../data/quests';
import { ITEMS } from '../item/Items';
import { events } from '../core/Events';

export type QState = 'hidden' | 'available' | 'active' | 'complete' | 'rewarded';
/** Tracks every quest's state and objective counters. Main quests auto-start in order;
 *  side quests start from their giver NPC and are claimed back at the giver. */
export class QuestManager {
  state: Record<string, QState> = {};
  counters: Record<string, number> = {};     // kill/catch/cook counters per quest
  tracked = '';                               // side quest pinned to the HUD
  constructor(private g: Game) {
    for (const q of QUESTS) this.state[q.id] = 'hidden';
    events.on('enemyKilled', (type: string) => this.bump('kill', type));
    events.on('fishCaught', () => this.bump('catch'));
    events.on('cooked', () => this.bump('cook'));
    events.on('inventory', () => this.refresh());
    events.on('flag', () => this.refresh());
  }
  def(id: string) { return QUESTS.find((q) => q.id === id)!; }
  private unlocked(q: QuestDef) { return (q.requires ?? []).every((r) => this.state[r] === 'rewarded') && (!q.requiresFlag || this.g.quest.has(q.requiresFlag)); }
  private bump(kind: 'kill' | 'catch' | 'cook', what?: string) {
    for (const q of QUESTS) if (this.state[q.id] === 'active') q.objectives.forEach((o, i) => {
      if (o.type === kind && (o.type !== 'kill' || o.enemy === what)) this.counters[`${q.id}.${i}`] = (this.counters[`${q.id}.${i}`] ?? 0) + 1;
    });
    this.refresh();
  }
  progress(q: QuestDef, o: Objective, i: number): [number, number] {
    switch (o.type) {
      case 'flag': return [this.g.quest.has(o.flag) ? 1 : 0, 1];
      case 'item': return [Math.min(o.count, this.g.inv.count(o.item)), o.count];
      default: return [Math.min(o.count, this.counters[`${q.id}.${i}`] ?? 0), o.count];
    }
  }
  done(q: QuestDef) { return q.objectives.every((o, i) => { const [a, b] = this.progress(q, o, i); return a >= b; }); }
  /** Re-evaluate state transitions. Main quests chain automatically. */
  refresh() {
    let changed = false;
    for (const q of QUESTS) {
      const s = this.state[q.id];
      if (s === 'hidden' && this.unlocked(q)) {
        this.state[q.id] = q.main ? 'active' : 'available'; changed = true;
        if (q.main && q.id !== 'm1') this.g.ui.questBanner('새 메인 퀘스트', q.title);
      }
      if (this.state[q.id] === 'active' && this.done(q)) {
        if (q.turnIn) { this.state[q.id] = 'complete'; this.g.ui.toast(`퀘스트 목표 달성: ${q.title} · ${q.npc ?? ''}에게 돌아가자`); }
        else { this.state[q.id] = 'rewarded'; this.giveReward(q); this.g.ui.questBanner('퀘스트 완료', q.title); }
        changed = true;
      }
    }
    if (changed) { events.emit('questsChanged'); this.refresh(); }
  }
  accept(id: string) { if (this.state[id] !== 'available') return; this.state[id] = 'active'; this.tracked = id; this.g.ui.questBanner('퀘스트 수락', this.def(id).title); this.refresh(); events.emit('questsChanged'); }
  claim(id: string) {
    const q = this.def(id); if (this.state[id] !== 'complete') return;
    q.objectives.forEach((o) => { if (o.type === 'item' && o.consume) this.g.inv.take(o.item, o.count); });
    this.state[id] = 'rewarded'; this.giveReward(q);
    this.g.ui.questBanner('퀘스트 완료', q.title);
    this.g.relations[q.giver ?? ''] = (this.g.relations[q.giver ?? ''] ?? 0) + 1;
    if (this.tracked === id) this.tracked = '';
    events.emit('questsChanged'); this.refresh();
  }
  private giveReward(q: QuestDef) {
    const r = q.reward; if (!r) return;
    if (r.shells) this.g.inv.add('shell', r.shells);
    for (const [id, n] of r.items ?? []) { this.g.inv.add(id, n); this.g.codex.see('items', id); }
    if (r.flag) this.g.quest.set(r.flag);
    if (r.text) setTimeout(() => this.g.ui.toast(r.text!), 1200);
    this.g.audio.play('solve');
  }
  /** Dialogue hook: returns lines + action for a quest-giver NPC, or null. */
  npcQuest(npc: string): { lines: string[]; action: () => void } | null {
    for (const q of QUESTS) {
      if (q.giver !== npc) continue;
      const s = this.state[q.id];
      if (s === 'complete') return { lines: q.doneLines ?? ['고마워!'], action: () => this.claim(q.id) };
      if (s === 'available') return { lines: [...(q.startLines ?? [q.desc]), `[퀘스트] ${q.title}`], action: () => { this.accept(q.id); if (q.id === 's_fishing' && !this.g.inv.has('rod')) { this.g.inv.add('rod'); this.g.inv.wear('rod'); this.g.ui.toast('대나무 낚싯대를 받았다 (도구)'); } } };
    }
    return null;
  }
  activeMain() { return QUESTS.find((q) => q.main && this.state[q.id] === 'active') ?? null; }
  activeSide() { return QUESTS.filter((q) => !q.main && (this.state[q.id] === 'active' || this.state[q.id] === 'complete')); }
  marker(npc: string): '!' | '?' | '' {
    for (const q of QUESTS) if (q.giver === npc) { if (this.state[q.id] === 'complete') return '?'; if (this.state[q.id] === 'available') return '!'; }
    return '';
  }
  toJSON() { return { state: this.state, counters: this.counters, tracked: this.tracked }; }
  load(d: any, legacyFlags: (f: string) => boolean, has: (i: string) => boolean) {
    for (const q of QUESTS) this.state[q.id] = 'hidden';
    this.counters = {}; this.tracked = '';
    if (d?.state) { Object.assign(this.state, d.state); Object.assign(this.counters, d.counters ?? {}); this.tracked = d.tracked ?? ''; }
    else {
      // migrate v1 saves: derive main-quest progress from the old flags/items
      const doneMain = [legacyFlags('metElder'), has('sword'), has('lantern'), legacyFlags('bossDead'), legacyFlags('ending') || legacyFlags('pearlPlaced')];
      ['m1', 'm2', 'm3', 'm4', 'm5'].forEach((id, i) => { if (doneMain[i] && doneMain.slice(0, i).every(Boolean)) this.state[id] = 'rewarded'; });
    }
    this.refresh();
  }
  describe(q: QuestDef) { return q.objectives.map((o, i) => { const [a, b] = this.progress(q, o, i); return { label: o.label, a, b, done: a >= b }; }); }
  itemName(id: string) { return ITEMS[id]?.name ?? id; }
}
