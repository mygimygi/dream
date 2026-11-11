/** Hand-placed exploration content. Coordinates are on the island (x,z). */
export interface DigSpot { id: string; x: number; z: number; loot: [string, number][]; night?: boolean; hint?: string; event?: string; place?: string; requiresItem?: string; }
export const DIG_SPOTS: DigSpot[] = [
  { id: 'd_glasses', x: 5.2, z: 23.6, loot: [['glasses', 1]], hint: '꽃밭 흙이 조금 들떠 있다' },
  { id: 'd_map1', x: 26.5, z: 9.5, loot: [['heartPiece', 1], ['goldShell', 1]], place: 'applehill', requiresItem: 'map1' },
  { id: 'd_map2', x: 16, z: 86.5, loot: [], event: 'kingCrab', place: 'gullRock', requiresItem: 'map2' },
  { id: 'd_map3', x: 40, z: -19, loot: [['gloves', 1], ['owlFeather', 1]], night: true, place: 'pillarHill', requiresItem: 'map3' },
  // sparkling soil found by just exploring with the shovel
  { id: 'd_s1', x: -14, z: 50, loot: [['shell', 15]] }, { id: 'd_s2', x: 34, z: 40, loot: [['ore', 1], ['shell', 5]] },
  { id: 'd_s3', x: -40, z: 30, loot: [['ancientCoin', 1]] }, { id: 'd_s4', x: 60, z: 20, loot: [['heartPiece', 1]] },
  { id: 'd_s5', x: -20, z: -12, loot: [['ore', 1]] }, { id: 'd_s6', x: 10, z: -30, loot: [['map3', 1]] },
  { id: 'd_s7', x: -6, z: 66, loot: [['goldShell', 1]], night: true }, { id: 'd_s8', x: 46, z: 8, loot: [['heartPiece', 1]], night: true },
];
export interface Cracked { id: string; x: number; z: number; size: number; loot?: [string, number][]; opens?: string; }
export const CRACKED: Cracked[] = [
  { id: 'cr_grove', x: -58, z: -20, size: 2.4, opens: 'grove' },
  { id: 'cr_ore1', x: -10, z: -50, size: 1.2, loot: [['ore', 1]] }, { id: 'cr_ore2', x: 14, z: -44, size: 1.2, loot: [['ore', 1]] },
  { id: 'cr_ore3', x: 22, z: -60, size: 1.2, loot: [['ore', 1], ['shell', 10]] }, { id: 'cr_ore4', x: -18, z: -60, size: 1.2, loot: [['ore', 2]] },
  { id: 'cr_rare', x: -80, z: 12, size: 1.6, loot: [['heartPiece', 1], ['ancientCoin', 1]] },
];
export const HEAVY_ROCKS = [{ id: 'hv1', x: 9, z: -58 }, { id: 'hv2', x: 11, z: -56.5 }];
export const LEGEND_CHEST = { id: 'c_legend', x: 12.5, z: -60, loot: [['heartContainer', 1], ['ancientCoin', 2]] as [string, number][] };
export const FORAGE: { id: string; item: string; x: number; z: number }[] = [
  ...[[-52, 8], [-60, 0], [-66, 12], [-48, -6], [-70, -14], [-56, 20]].map(([x, z], i) => ({ id: `mush${i}`, item: 'mushroom', x, z })),
  ...[[-8, -58], [6, -70], [-12, -70], [14, -66]].map(([x, z], i) => ({ id: `herb${i}`, item: 'herb', x, z })),
  ...[[23.5, 6.5], [29.5, 9], [26, 13]].map(([x, z], i) => ({ id: `apple${i}`, item: 'apple', x, z })),
  ...[[21, 11], [-26, 15]].map(([x, z], i) => ({ id: `veg${i}`, item: 'vegetable', x, z })),
];
export const POTS_COOK = [{ x: -5.5, z: 25 }, { x: 5, z: 72 }];
export const TOY_BOAT = { x: 34, z: 3 };
export const GULL_ROCK = { x: 19, z: 88.5 };
export const PILLAR_HILL = [[37.5, -21], [42.5, -21], [40, -16.5]];
export const WOLF_SPOT = { x: -46, z: 13 };
export const ARCHERY = { sign: { x: 12, z: 46 }, stand: { x: 12, z: 48 }, targets: { z: 60, x0: 4, x1: 20 } };
export const RACE = { sign: { x: -8, z: 46 }, rings: [[-8, 52], [-16, 60], [-22, 70], [-12, 76], [0, 70], [6, 60], [0, 52], [-6, 47]] as [number, number][] };
export const ARENA = { sign: { x: 22, z: -4 }, center: { x: 26, z: -10 } };
export const GROVE = { x: 1300, z: 0 };
export const SKY = { x: 1600, z: 0 };
/** NPC daily routines: where they stand in each period (night = indoors / hidden). */
export const SCHEDULES: Record<string, { morning: [number, number]; day: [number, number]; evening: [number, number]; night?: [number, number] }> = {
  elder: { morning: [-10.5, 17.5], day: [-9, 17], evening: [-3, 21] },
  baker: { morning: [-10.5, 29.5], day: [-9, 29.5], evening: [-1.5, 25.5] },
  fisher: { morning: [10, 36.5], day: [2, 74], evening: [3, 23] },
  kid: { morning: [-18, 26], day: [-4, 30], evening: [1.5, 20.5] },
  smith: { morning: [-3.5, 37], day: [-3.5, 37], evening: [-4.5, 22] },
};
export const HOMES: Record<string, [number, number]> = { elder: [-12, 13], baker: [-13, 32], fisher: [13.5, 32.5], kid: [-22, 22], smith: [-3.5, 39] };
