/** Quest content as data. Objectives are checked by QuestManager against game state/events. */
export type Objective =
  | { type: 'flag'; flag: string; label: string }
  | { type: 'item'; item: string; count: number; consume?: boolean; label: string }
  | { type: 'kill'; enemy: string; count: number; label: string }
  | { type: 'catch'; count: number; label: string }
  | { type: 'cook'; count: number; label: string };
export interface QuestDef {
  id: string; main?: boolean; title: string; desc: string; npc?: string; giver?: string;
  requires?: string[];            // quest ids that must be rewarded first
  requiresFlag?: string;
  objectives: Objective[];
  target?: { x: number; z: number; label: string };
  reward?: { items?: [string, number][]; shells?: number; flag?: string; text?: string };
  turnIn?: boolean;               // must return to giver to claim
  startLines?: string[]; doneLines?: string[];
}
export const QUESTS: QuestDef[] = [
  // ------------------------------------------------------------- main story
  { id: 'm1', main: true, title: '바람이 멎은 섬', desc: '섬에 바람이 끊겼다. 마을의 소라 할머니를 찾아가 이야기를 듣자.', objectives: [{ type: 'flag', flag: 'metElder', label: '소라 할머니와 대화' }], target: { x: -9, z: 17, label: '소라 할머니' } },
  { id: 'm2', main: true, title: '아버지의 산호검', desc: '집 오른쪽 마당 상자에 아버지가 쓰던 검이 있다.', requires: ['m1'], objectives: [{ type: 'item', item: 'sword', count: 1, label: '산호검 얻기' }], target: { x: 17.5, z: 17, label: '검 상자' } },
  { id: 'm3', main: true, title: '등대 폐허의 등불', desc: '옛 등대 폐허의 문은 무거운 돌이 발판을 눌러야 열린다. 안쪽에 바다불 등불이 잠들어 있다.', requires: ['m2'], objectives: [{ type: 'item', item: 'lantern', count: 1, label: '바다불 등불 얻기' }], target: { x: 56, z: 50, label: '옛 등대 폐허' } },
  { id: 'm4', main: true, title: '물빛 동굴의 주인', desc: '북쪽 산길에서 서쪽으로 갈라진 길 끝, 물빛 동굴 깊은 곳에 달진주가 있다.', requires: ['m3'], objectives: [{ type: 'flag', flag: 'bossDead', label: '가시고둥왕 물리치기' }, { type: 'item', item: 'moonPearl', count: 1, label: '달진주 되찾기' }], target: { x: -31, z: -46.5, label: '물빛 동굴' } },
  { id: 'm5', main: true, title: '달빛 사원', desc: '구름봉 꼭대기 사원 제단에 달진주를 바치자.', requires: ['m4'], objectives: [{ type: 'flag', flag: 'pearlPlaced', label: '제단에 달진주 바치기' }], target: { x: 0, z: -82, label: '달빛 사원' } },
  { id: 'm6', main: true, title: '숲의 바람돌', desc: '제단의 문구: "세 바람이 모일 때 하늘 길이 열린다." 이끼숲 남쪽 금 간 바위벽 너머에서 초록 바람이 느껴진다. 할머니가 준 폭탄으로 벽을 부수자.', requires: ['m5'], objectives: [{ type: 'item', item: 'windForest', count: 1, label: '숲의 바람돌 얻기' }], target: { x: -58, z: -20, label: '금 간 바위벽' }, reward: { items: [['bomb', 3]] } },
  { id: 'm7', main: true, title: '바다의 바람돌', desc: '도윤 아저씨가 준 보물지도 ②: "갈매기 바위가 내려다보는 모래밭". 그곳을 삽으로 파 보자.', requires: ['m6'], objectives: [{ type: 'item', item: 'windSea', count: 1, label: '바다의 바람돌 얻기' }], target: { x: 16, z: 86, label: '조가비 해변' } },
  { id: 'm8', main: true, title: '하늘 길', desc: '세 바람을 사원 제단에 모으고 하늘 길로 올라가 폭풍의 주인과 맞서자.', requires: ['m7'], objectives: [{ type: 'flag', flag: 'stonesPlaced', label: '제단에 바람돌 두 개 바치기' }, { type: 'flag', flag: 'finalBossDead', label: '폭풍해파리 물리치기' }], target: { x: 0, z: -82, label: '달빛 사원' } },
  // ------------------------------------------------------------- side quests
  { id: 's_boat', title: '잃어버린 장난감 배', giver: 'kid', npc: '꼬마 모래', desc: '꼬마 모래가 호수 가는 길 덤불 근처에서 장난감 배를 잃어버렸다.', objectives: [{ type: 'item', item: 'toyBoat', count: 1, consume: true, label: '장난감 배 찾기 (호수 가는 길)' }], turnIn: true,
    reward: { items: [['shovel', 1]], text: '모래 삽을 얻었다!' }, startLines: ['내 장난감 배를 호수 가는 길 덤불에서 잃어버렸어… 찾아 주면 내 보물 삽을 줄게!'], doneLines: ['내 배다! 고마워! 약속대로 이 삽 줄게. 반짝이는 흙을 파 봐!'] },
  { id: 's_glasses', title: '할머니의 안경', giver: 'elder', npc: '소라 할머니', requires: ['s_boat'], desc: '할머니가 우물 동쪽 벤치 근처 꽃밭에서 안경을 떨어뜨렸다. 흙에 묻혔을지도 모른다.', objectives: [{ type: 'item', item: 'glasses', count: 1, consume: true, label: '안경 찾기 (우물 동쪽 벤치 근처를 파기)' }], turnIn: true,
    reward: { items: [['heartPiece', 1]], text: '하트 조각을 얻었다!' }, startLines: ['아이고, 우물 동쪽 벤치에 앉았다가 안경을 떨어뜨렸는데 흙에 묻혔나 봐. 삽이 있으면 좀 찾아 주렴.'], doneLines: ['내 안경! 이제 잘 보이는구나. 고마운 마음에 이걸 주마. 옛날에 주운 하트 조각이란다.'] },
  { id: 's_mushroom', title: '버섯 수프 재료', giver: 'baker', npc: '다래', desc: '빵집 다래가 수프용 숲 버섯 3개가 필요하다고 한다.', objectives: [{ type: 'item', item: 'mushroom', count: 3, consume: true, label: '숲 버섯 3개 가져다주기' }], turnIn: true,
    reward: { items: [['map1', 1], ['apple', 2]], shells: 20, text: '낡은 보물지도 ①을 얻었다!' }, startLines: ['이끼숲에 통통한 버섯이 자라거든. 3개만 따다 줄래? 대신 할아버지가 남긴 보물지도를 줄게!'], doneLines: ['향이 좋다! 약속한 보물지도야. 세 그루 사과나무라니, 어디일까?'] },
  { id: 's_fishing', title: '첫 낚시', giver: 'fisher', npc: '도윤 아저씨', desc: '도윤 아저씨에게 낚싯대를 빌렸다. 아무 물고기나 3마리 잡아 보자.', objectives: [{ type: 'catch', count: 3, label: '물고기 3마리 낚기' }], turnIn: true,
    reward: { shells: 30, flag: 'contestOpen', text: '낚시 대회에 참가할 수 있게 됐다!' }, startLines: ['바람이 없어도 낚시는 되지! 이 낚싯대 줄 테니 3마리만 낚아 와 봐. 물가에서 도구를 쓰면 된다.'], doneLines: ['제법인데? 이제 우리 낚시 대회에도 나와 봐!'] },
  { id: 's_ore', title: '단단한 광석', giver: 'smith', npc: '대장장이 바위', requiresFlag: 'pearlPlaced', desc: '대장장이 바위에게 단단한 광석 2개를 가져다주자. 금 간 바위를 폭탄으로 부수면 나온다.', objectives: [{ type: 'item', item: 'ore', count: 2, consume: true, label: '단단한 광석 2개' }], turnIn: true,
    reward: { items: [['bomb', 5]], flag: 'freeUpgrade', text: '다음 장비 강화 1회 무료!' }, startLines: ['폭탄이 생겼다며? 산에 금 간 바위들을 부수면 광석이 나온다. 2개만 가져와!'], doneLines: ['좋은 광석이군! 다음 강화는 공짜로 해 주지.'] },
  { id: 's_beetles', title: '딱정이 퇴치', giver: 'smith', npc: '대장장이 바위', requires: ['m2'], desc: '도토리딱정이들이 밭을 망친다. 5마리를 물리치자.', objectives: [{ type: 'kill', enemy: 'acorn', count: 5, label: '도토리딱정이 5마리 물리치기' }], turnIn: true,
    reward: { shells: 40, items: [['arrow', 10]], text: '반짝 조개 40개와 화살 10개!' }, startLines: ['딱정이 녀석들이 텃밭을 들쑤시고 다녀. 5마리만 혼내 줘!'], doneLines: ['덕분에 밭이 조용해졌다. 받아!'] },
  { id: 's_wolf', title: '다친 늑대', giver: 'wolf', npc: '다친 늑대', desc: '이끼숲 길가에 다친 늑대가 웅크리고 있다. 요리를 먹이면 기운을 차릴지도 모른다.', objectives: [{ type: 'cook', count: 1, label: '요리 하나 만들어 오기' }], turnIn: true,
    reward: { flag: 'wolfFriend', text: '늑대가 동료가 되었다! (탈것 버튼으로 탑승)' }, startLines: ['(늑대가 힘없이 낑낑거린다. 배가 고파 보인다.)'], doneLines: ['(늑대가 요리를 맛있게 먹고 꼬리를 흔든다. 이제 함께 다닐 수 있을 것 같다!)'] },
];
