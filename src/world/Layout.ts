/** Hand-placed points of interest on the island. All gameplay placement reads from here. */
export const START = { x: 10.5, z: 19.5, yaw: Math.PI };
export const HOUSES = [
  { id: 'hero', x: 12, z: 12, kind: 'cottage', roof: 0xe8873a, seed: 3 },
  { id: 'elder', x: -12, z: 13, kind: 'cottage', roof: 0x3aa6a0, seed: 7 },
  { id: 'bakery', x: -13, z: 32, kind: 'plank', roof: 0xd0503a, seed: 11 },
  { id: 'fisher', x: 13.5, z: 32.5, kind: 'cottage', roof: 0x7a6ad0, seed: 19 },
  { id: 'kid', x: -22, z: 22, kind: 'cottage', roof: 0xe8c040, seed: 23 },
];
export const WELL = { x: 0, z: 22 };
export interface ChestDef { id: string; x: number; z: number; yaw: number; item: string; count?: number; big?: boolean; dungeon?: boolean; hidden?: boolean; }
export const CHESTS: ChestDef[] = [
  { id: 'c_sword', x: 17.5, z: 17, yaw: -0.6, item: 'sword' },
  { id: 'c_shield', x: -77, z: -16, yaw: 0.6, item: 'shield' },
  { id: 'c_lantern', x: 56, z: 59, yaw: Math.PI, item: 'lantern', big: true },
  { id: 'c_heart', x: 67, z: -11, yaw: -1.2, item: 'heartContainer', big: true },
  { id: 'c_shells', x: 8, z: 86, yaw: Math.PI, item: 'shell', count: 30 },
  { id: 'c_berry', x: 31, z: -13, yaw: Math.PI, item: 'berry', count: 3 },
  { id: 'c_coast', x: -86, z: 30, yaw: 1.4, item: 'starShard' },
  // dungeon (x offset 1000)
  { id: 'd_key', x: 1000, z: -40, yaw: Math.PI, item: 'smallKey', dungeon: true, hidden: true },
  { id: 'd_map', x: 1007, z: -2, yaw: -Math.PI / 2, item: 'berry', count: 2, dungeon: true },
];
export const SIGNS = [
  { x: 4, z: 6.5, text: '↑ 구름봉 산길 · 달빛 사원\n← 이끼숲   → 옛 등대 폐허' },
  { x: -3.5, z: 44, text: '↓ 조가비 해변\n바다 쪽으로 너무 멀리 가지 마세요.' },
  { x: 33, z: 9, text: '↗ 거울 호수\n다리 건너 작은 섬이 있어요.' },
  { x: -44, z: 16, text: '이끼숲\n덤불 너머 길은 칼로 열 수 있어요.' },
  { x: 47, z: 39, text: '옛 등대 폐허\n"무거운 돌이 문을 깨운다"' },
  { x: -24, z: -40, text: '물빛 동굴\n안은 아주 어둡다. 등불이 필요하다.' },
];
export const POTS = [[5, 16], [6, 16.8], [-7, 18], [-7.8, 18.8], [-9, 28], [9, 27.5], [8.5, 28.5], [-17.5, 25], [-16.5, 21]];
export const STATUES = [[-6, -66, 0.2], [6, -66, -0.2], [42, 44, 0.8], [31, -17, 0], [-26, -38, 0.6]];
export const RUINS_PUZZLE = { block: { x: 50, z: 47 }, plate: { x: 60, z: 47 }, gate: { x: 56, z: 54.5, yaw: 0 } };
export const BRIDGE = { x0: 38.5, x1: 62, z: -10, y: 2.2 };
export const CAVE = { x: -31, z: -46.5, yaw: 0.65 };
export const TEMPLE_POS = { x: 0, z: -82 };
export const NPCS = [
  { id: 'elder', name: '소라 할머니', x: -9, z: 17, look: 'elder' },
  { id: 'baker', name: '다래', x: -9, z: 29.5, look: 'baker' },
  { id: 'fisher', name: '도윤 아저씨', x: 2, z: 74, look: 'fisher' },
  { id: 'kid', name: '꼬마 모래', x: -18, z: 26, look: 'kid' },
];
export const ENEMY_SPAWNS: { type: string; x: number; z: number }[] = [
  { type: 'acorn', x: 10, z: 52 }, { type: 'acorn', x: -14, z: 56 }, { type: 'acorn', x: 24, z: 42 }, { type: 'acorn', x: -30, z: 8 },
  { type: 'acorn', x: 20, z: -6 }, { type: 'acorn', x: -12, z: -18 },
  { type: 'shroom', x: -52, z: 2 }, { type: 'shroom', x: -60, z: -8 }, { type: 'shroom', x: -70, z: -4 }, { type: 'shroom', x: -66, z: 14 }, { type: 'shroom', x: -76, z: -20 },
  { type: 'crab', x: -8, z: 78 }, { type: 'crab', x: 14, z: 80 }, { type: 'crab', x: 26, z: 76 }, { type: 'crab', x: 82, z: 6 },
  { type: 'acorn', x: 52, z: 38 }, { type: 'acorn', x: 62, z: 42 },
  { type: 'shroom', x: 4, z: -48 }, { type: 'acorn', x: -6, z: -36 },
];
