/** Extra item definitions for the adventure expansion (merged into ITEMS). Data only. */
export const EXTRA_ITEMS: Record<string, { id: string; name: string; desc: string; kind: string; stack?: boolean; price?: number; heal?: number; color?: number }> = {
  // ---- tools ----
  shovel: { id: 'shovel', name: '모래 삽', kind: 'tool', desc: '도구로 쓰면 발밑을 판다. 반짝이는 흙이나 보물지도의 장소를 파 보자.' },
  bomb: { id: 'bomb', name: '조개 폭탄', kind: 'tool', stack: true, price: 6, desc: '도구로 쓰면 앞에 놓는다. 잠시 뒤 터져 금 간 바위와 벽을 부수고 몬스터에게 피해를 준다.' },
  bow: { id: 'bow', name: '바람 활', kind: 'tool', desc: '도구로 쓰면 화살을 쏜다. 멀리 있는 표적과 눈 모양 스위치를 맞힐 수 있다.' },
  arrow: { id: 'arrow', name: '화살', kind: 'ammo', stack: true, price: 2, desc: '바람 활에 쓰는 화살.' },
  rod: { id: 'rod', name: '대나무 낚싯대', kind: 'tool', desc: '물가에서 도구로 쓰면 낚시를 시작한다. 찌가 흔들리면 공격 버튼!' },
  gloves: { id: 'gloves', name: '거인의 장갑', kind: 'gear', desc: '지니고 있으면 길을 막은 무거운 바위를 들어 치울 수 있다.' },
  // ---- materials ----
  mushroom: { id: 'mushroom', name: '숲 버섯', kind: 'material', stack: true, price: 3, desc: '이끼숲 그늘에서 자라는 통통한 버섯. 요리 재료.' },
  apple: { id: 'apple', name: '빨간 사과', kind: 'material', stack: true, price: 3, desc: '사과나무를 흔들면 떨어진다. 요리 재료.' },
  vegetable: { id: 'vegetable', name: '텃밭 채소', kind: 'material', stack: true, price: 3, desc: '마을 텃밭에서 뽑은 싱싱한 채소. 요리 재료.' },
  crabMeat: { id: 'crabMeat', name: '게살', kind: 'material', stack: true, price: 5, desc: '소라게를 물리치면 가끔 얻는다. 요리 재료.' },
  herb: { id: 'herb', name: '구름풀', kind: 'material', stack: true, price: 12, desc: '구름봉 높은 곳에서만 자라는 희귀한 풀. 특제 요리 재료.' },
  ore: { id: 'ore', name: '단단한 광석', kind: 'material', stack: true, price: 10, desc: '금 간 바위를 부수거나 땅을 파면 나온다. 장비 강화 재료.' },
  // ---- dishes ----
  soup: { id: 'soup', name: '사과 버섯 수프', kind: 'food', stack: true, price: 10, heal: 6, desc: '하트 3칸 회복.' },
  fishGrill: { id: 'fishGrill', name: '생선 버섯구이', kind: 'food', stack: true, price: 16, heal: 6, desc: '하트 3칸 회복, 2분간 받는 피해 절반.' },
  crabStir: { id: 'crabStir', name: '든든한 게살 볶음', kind: 'food', stack: true, price: 18, heal: 8, desc: '하트 4칸 회복, 3분간 최대 하트 +2.' },
  applePie: { id: 'applePie', name: '사과 열매 파이', kind: 'food', stack: true, price: 14, heal: 2, desc: '하트 1칸 회복, 2분간 이동 속도 증가.' },
  vegSkewer: { id: 'vegSkewer', name: '채소 꼬치', kind: 'food', stack: true, price: 8, heal: 4, desc: '하트 2칸 회복.' },
  cloudFeast: { id: 'cloudFeast', name: '구름 특제 정식', kind: 'food', stack: true, price: 40, heal: 99, desc: '체력 전부 회복, 3분간 이동 속도 증가와 피해 감소.' },
  burnt: { id: 'burnt', name: '정체불명의 요리', kind: 'food', stack: true, price: 1, heal: 1, desc: '음… 반 칸 정도는 회복된다.' },
  // ---- quest & treasure ----
  windForest: { id: 'windForest', name: '숲의 바람돌', kind: 'quest', desc: '이끼숲 수호자가 지키던 초록빛 바람돌. 사원 제단에 바쳐야 한다.' },
  windSea: { id: 'windSea', name: '바다의 바람돌', kind: 'quest', desc: '대왕소라게가 품고 있던 푸른 바람돌. 사원 제단에 바쳐야 한다.' },
  toyBoat: { id: 'toyBoat', name: '꼬마의 장난감 배', kind: 'quest', desc: '꼬마 모래가 잃어버린 나무 배.' },
  glasses: { id: 'glasses', name: '할머니의 안경', kind: 'quest', desc: '소라 할머니가 잃어버린 동그란 안경.' },
  map1: { id: 'map1', name: '낡은 보물지도 ①', kind: 'map', desc: '"세 그루 사과나무 사이, 동쪽 언덕." 그림 속 X 표시를 파 보자.' },
  map2: { id: 'map2', name: '낡은 보물지도 ②', kind: 'map', desc: '"갈매기 바위가 내려다보는 모래밭." 해변 어딘가를 파 보자.' },
  map3: { id: 'map3', name: '낡은 보물지도 ③', kind: 'map', desc: '"돌기둥 셋이 선 언덕, 달이 뜬 뒤에만 흙이 빛난다."' },
  heartPiece: { id: 'heartPiece', name: '하트 조각', kind: 'upgrade', desc: '4개를 모으면 최대 하트가 1칸 늘어난다.' },
  goldShell: { id: 'goldShell', name: '황금 조개', kind: 'treasure', price: 60, desc: '드물게 묻혀 있는 황금빛 조개. 상점에 비싸게 팔 수 있다.' },
  ancientCoin: { id: 'ancientCoin', name: '고대 동전', kind: 'treasure', price: 40, desc: '옛 섬사람들이 쓰던 동전. 수집품.' },
  owlFeather: { id: 'owlFeather', name: '부엉이 깃털', kind: 'treasure', desc: '전설의 상자에서 나온 깃털 장식. 수집품.' },
};

export interface FishDef { id: string; name: string; size: [number, number]; rarity: 1 | 2 | 3 | 4 | 5; price: number; where: ('beach' | 'lake' | 'coast')[]; time?: 'day' | 'night'; speed: number; jumpy: number; color: number; belly: number; scale: number; desc: string; }
/** rarity: 1 common .. 5 legendary. speed/jumpy drive the reeling minigame. */
export const FISH: FishDef[] = [
  { id: 'fish_minnow', name: '은빛 송사리', size: [4, 8], rarity: 1, price: 4, where: ['lake', 'beach'], speed: 0.6, jumpy: 0.2, color: 0xb8c8d8, belly: 0xf0f4f8, scale: 0.45, desc: '어디서나 보이는 작은 물고기.' },
  { id: 'fish_carp', name: '호수 붕어', size: [18, 32], rarity: 1, price: 8, where: ['lake'], speed: 0.8, jumpy: 0.3, color: 0x8a7a4a, belly: 0xd8c890, scale: 0.75, desc: '거울 호수의 터줏대감.' },
  { id: 'fish_bream', name: '분홍 도미', size: [22, 40], rarity: 2, price: 14, where: ['beach', 'coast'], speed: 1.0, jumpy: 0.4, color: 0xe88a90, belly: 0xffe0e0, scale: 0.8, desc: '바다에서 잡히는 분홍빛 물고기.' },
  { id: 'fish_mackerel', name: '줄무늬 고등어', size: [25, 38], rarity: 2, price: 12, where: ['beach', 'coast'], speed: 1.3, jumpy: 0.5, color: 0x3a6a9a, belly: 0xe8eef6, scale: 0.8, desc: '빠르게 헤엄치는 등푸른 물고기.' },
  { id: 'fish_puffer', name: '복어 동동이', size: [12, 22], rarity: 2, price: 16, where: ['beach'], speed: 0.7, jumpy: 0.8, color: 0xe8c860, belly: 0xfff6d0, scale: 0.6, desc: '놀라면 동그랗게 부푼다.' },
  { id: 'fish_trout', name: '무지개 송어', size: [28, 45], rarity: 3, price: 24, where: ['lake'], speed: 1.4, jumpy: 0.6, color: 0x7aa86a, belly: 0xf0a0b0, scale: 0.9, desc: '옆구리에 무지개 띠가 있다.' },
  { id: 'fish_eel', name: '밤뱀장어', size: [40, 80], rarity: 3, price: 30, where: ['lake', 'coast'], time: 'night', speed: 1.6, jumpy: 0.3, color: 0x3a3a4a, belly: 0x8a8a6a, scale: 1.1, desc: '밤에만 모습을 드러낸다.' },
  { id: 'fish_flounder', name: '모래 가자미', size: [20, 35], rarity: 2, price: 15, where: ['beach'], speed: 0.9, jumpy: 0.2, color: 0xc8b088, belly: 0xf6eee0, scale: 0.75, desc: '모래 바닥에 납작 숨어 산다.' },
  { id: 'fish_tuna', name: '대왕 참치', size: [80, 140], rarity: 4, price: 60, where: ['coast'], speed: 2.0, jumpy: 0.5, color: 0x2a3a6a, belly: 0xc8d0e0, scale: 1.4, desc: '절벽 아래 깊은 바다의 힘센 물고기.' },
  { id: 'fish_moon', name: '달빛 해파리고기', size: [15, 25], rarity: 4, price: 55, where: ['lake', 'beach'], time: 'night', speed: 1.5, jumpy: 0.9, color: 0x9ac8f0, belly: 0xf0f8ff, scale: 0.7, desc: '달밤에 은은하게 빛난다.' },
  { id: 'fish_gold', name: '황금 잉어', size: [30, 50], rarity: 4, price: 90, where: ['lake'], speed: 1.8, jumpy: 0.7, color: 0xf2c94c, belly: 0xfff0b0, scale: 0.95, desc: '보면 행운이 온다는 금빛 잉어.' },
  { id: 'fish_legend', name: '전설의 무지개고래치', size: [120, 200], rarity: 5, price: 200, where: ['coast'], time: 'night', speed: 2.4, jumpy: 1.0, color: 0x6ad8c8, belly: 0xfff0f8, scale: 1.7, desc: '섬의 전설로만 전해지던 물고기.' },
];

export interface Recipe { id: string; ingredients: string[]; out: string; }
/** ingredient tags: 'fish' matches any fish. Order-free; matched by sorted tags. */
export const RECIPES: Recipe[] = [
  { id: 'r_soup', ingredients: ['apple', 'mushroom'], out: 'soup' },
  { id: 'r_fishGrill', ingredients: ['fish', 'mushroom'], out: 'fishGrill' },
  { id: 'r_crabStir', ingredients: ['crabMeat', 'vegetable'], out: 'crabStir' },
  { id: 'r_applePie', ingredients: ['apple', 'berry'], out: 'applePie' },
  { id: 'r_vegSkewer', ingredients: ['vegetable', 'vegetable'], out: 'vegSkewer' },
  { id: 'r_cloudFeast', ingredients: ['fish', 'herb', 'apple'], out: 'cloudFeast' },
];
export const BUFFS: Record<string, { name: string; speed?: number; defense?: number; hearts?: number; dur: number }> = {
  fishGrill: { name: '든든함 (피해 절반)', defense: 0.5, dur: 120 },
  crabStir: { name: '기운 (최대 하트 +2)', hearts: 2, dur: 180 },
  applePie: { name: '가벼운 발걸음 (속도 +35%)', speed: 1.35, dur: 120 },
  cloudFeast: { name: '구름 축복 (속도·방어)', speed: 1.3, defense: 0.6, dur: 180 },
};
