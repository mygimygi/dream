import { FISH } from '../data/itemsData';
import { REGION_NAMES } from '../world/Heightfield';
import { events } from '../core/Events';

export type CodexCat = 'fish' | 'monsters' | 'plants' | 'items' | 'treasures' | 'dishes' | 'places';
export const CODEX_CATS: { id: CodexCat; label: string }[] = [
  { id: 'fish', label: '물고기' }, { id: 'monsters', label: '몬스터' }, { id: 'plants', label: '식물·채집' }, { id: 'items', label: '아이템·도구' },
  { id: 'treasures', label: '보물' }, { id: 'dishes', label: '요리' }, { id: 'places', label: '지역·유적' },
];
export const MONSTERS: Record<string, { name: string; desc: string; color: string }> = {
  acorn: { name: '도토리딱정이', desc: '도토리 모자를 쓴 딱정이. 몸을 낮추면 돌진한다.', color: '#8a5a2e' },
  shroom: { name: '버섯꼬마', desc: '거리를 두고 포자 덩어리를 뱉는다.', color: '#7a4ac8' },
  crab: { name: '소라게', desc: '옆걸음으로 다가와 집게를 든 뒤 꼬집는다.', color: '#d8553a' },
  moth: { name: '등불나방', desc: '어둠 속을 맴돌다 급강하한다. 밤에는 섬에도 나타난다.', color: '#9ff0ff' },
  boss: { name: '가시고둥왕', desc: '물빛 동굴의 주인. 껍데기로 굴러오다 벽에 부딪히면 어지러워한다.', color: '#d86a7a' },
  guardian: { name: '이끼숲 수호자', desc: '숲의 바람돌을 지키는 거대 딱정이. 폭탄에 맞으면 넘어진다.', color: '#4f8f2e' },
  kingCrab: { name: '대왕소라게', desc: '바다의 바람돌을 품은 거대 소라게. 껍데기에 숨으면 폭탄으로 깨야 한다.', color: '#e0705a' },
  storm: { name: '폭풍해파리', desc: '섬의 바람을 삼킨 하늘의 해파리. 눈이 열릴 때 화살로 쏘아 떨어뜨리자.', color: '#9a7ae0' },
};
const PLANTS = ['mushroom', 'apple', 'vegetable', 'berry', 'herb', 'crabMeat', 'ore'];
const ITEMS_LIST = ['sword', 'steelSword', 'whaleSword', 'shield', 'turtleShield', 'leatherVest', 'shellArmor', 'lantern', 'shovel', 'bomb', 'bow', 'rod', 'gloves'];
const TREASURES = ['heartPiece', 'heartContainer', 'starShard', 'goldShell', 'ancientCoin', 'owlFeather', 'moonPearl', 'windForest', 'windSea'];
const DISHES = ['soup', 'fishGrill', 'crabStir', 'applePie', 'vegSkewer', 'cloudFeast', 'burnt'];
export const SECRET_PLACES: Record<string, string> = { grove: '수호자의 숲 공터', gullRock: '갈매기 바위', skyIsle: '하늘 정원', applehill: '세 그루 사과나무 언덕', pillarHill: '돌기둥 언덕' };

/** Discovery log for every collectible category; drives the 도감 screen. */
export class Codex {
  seen: Record<string, { order: number; where: string }> = {};
  private n = 0;
  where = () => '';
  static all(): Record<CodexCat, string[]> {
    return { fish: FISH.map((f) => f.id), monsters: Object.keys(MONSTERS), plants: PLANTS, items: ITEMS_LIST, treasures: TREASURES, dishes: DISHES, places: [...Object.keys(REGION_NAMES), ...Object.keys(SECRET_PLACES)] };
  }
  see(cat: CodexCat, id: string) {
    const all = Codex.all()[cat];
    if (!all?.includes(id)) return false;
    const k = `${cat}:${id}`;
    if (this.seen[k]) return false;
    this.seen[k] = { order: ++this.n, where: this.where() };
    events.emit('codexNew', { cat, id });
    return true;
  }
  /** called for any item the player receives */
  seeItem(id: string) { for (const c of ['plants', 'items', 'treasures', 'dishes'] as CodexCat[]) this.see(c, id); }
  has(cat: CodexCat, id: string) { return !!this.seen[`${cat}:${id}`]; }
  stats(cat?: CodexCat) {
    const all = Codex.all(); const cats = cat ? [cat] : (Object.keys(all) as CodexCat[]);
    let a = 0, b = 0; for (const c of cats) { b += all[c].length; a += all[c].filter((i) => this.has(c, i)).length; }
    return { a, b, pct: b ? Math.round((a / b) * 100) : 0 };
  }
  toJSON() { return { seen: this.seen, n: this.n }; }
  load(d: any) { this.seen = { ...(d?.seen ?? {}) }; this.n = d?.n ?? Object.keys(this.seen).length; }
}
