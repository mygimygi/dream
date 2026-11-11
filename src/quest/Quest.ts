import { events } from '../core/Events';
import { Inventory } from '../inventory/Inventory';

/** Story flags, the main objective chain, and NPC dialogue (all original writing). */
export interface Line { who: string; text: string; choices?: { label: string; value: string }[]; }
export class Quest {
  flags = new Set<string>();
  constructor(public inv: Inventory) {}
  has(f: string) { return this.flags.has(f); }
  set(f: string) { if (this.flags.has(f)) return; this.flags.add(f); events.emit('flag', f); events.emit('quest'); }
  stage(): number {
    if (this.has('ending')) return 6;
    if (this.inv.has('moonPearl')) return 5;
    if (this.has('enteredCave')) return 4;
    if (this.inv.has('lantern')) return 3;
    if (this.inv.has('sword')) return 2;
    if (this.has('metElder')) return 1;
    return 0;
  }
  objective(): { title: string; hint: string } {
    switch (this.stage()) {
      case 0: return { title: '소라 할머니 만나기', hint: '마을 서쪽 청록 지붕 집 앞에 있어요.' };
      case 1: return { title: '집 앞 상자에서 검 꺼내기', hint: '내 집(주황 지붕) 오른쪽 마당에 상자가 있어요.' };
      case 2: return { title: '옛 등대 폐허에서 등불 찾기', hint: '마을 동쪽 길 끝. 무거운 돌을 발판 위로 밀어 보세요.' };
      case 3: return { title: '물빛 동굴로 들어가기', hint: '북쪽 산길 갈림길에서 서쪽. 바위 아치 아래 입구.' };
      case 4: return { title: '동굴 깊은 곳의 주인 물리치기', hint: '횃불에 등불(도구)로 불을 붙이고 길을 여세요.' };
      case 5: return { title: '달빛 사원에 달진주 바치기', hint: '구름봉 꼭대기 사원 한가운데 제단.' };
      default: return { title: '섬을 자유롭게 탐험하기', hint: '숨은 보물상자와 별 조각을 찾아보세요.' };
    }
  }
  npcLines(id: string): Line[] {
    const s = this.stage();
    switch (id) {
      case 'elder':
        if (s === 0) return [
          { who: '소라 할머니', text: '오, 미루 왔구나. 요 며칠 섬에 바람이 뚝 끊긴 걸 느꼈니?' },
          { who: '소라 할머니', text: '달빛 사원 제단의 달진주가 사라졌단다. 물빛 동굴 깊은 곳에서 가시고둥왕이 품고 있다는 소문이야.' },
          { who: '소라 할머니', text: '맨손으로는 위험해. 네 집 오른쪽 마당 상자에 아버지가 쓰던 산호검이 있을 게다.' },
          { who: '소라 할머니', text: '동굴은 아주 어두우니 동쪽 폐허에 잠든 바다불 등불도 꼭 챙기렴.' },
        ];
        if (s === 1) return [{ who: '소라 할머니', text: '검은 네 집 오른쪽 마당 상자에 있단다. 주황 지붕 집 말이야.' }];
        if (s === 2) return [{ who: '소라 할머니', text: '폐허 문은 무거운 돌이 발판을 눌러야 열린다고 들었어. 힘으로 밀어 보렴.' }, { who: '소라 할머니', text: '이끼숲 덤불 너머에는 튼튼한 방패가 숨겨져 있다더구나.' }];
        if (s === 3 || s === 4) return [{ who: '소라 할머니', text: '물빛 동굴은 북쪽 산길에서 서쪽으로 갈라진 길 끝에 있단다. 조심하렴.' }];
        if (s === 5) return [{ who: '소라 할머니', text: '달진주를 되찾았구나! 어서 구름봉 꼭대기 사원에 바치렴.' }];
        return [{ who: '소라 할머니', text: '바람이 돌아왔어. 고맙다, 미루. 이제 섬 구석구석을 마음껏 돌아다녀 보렴.' }];
      case 'baker':
        return [
          { who: '다래', text: '갓 구운 조개빵… 은 오늘 다 팔렸어. 대신 회복 열매는 있어!' },
          { who: '다래', text: '반짝 조개 10개에 회복 열매 하나, 어때?', choices: [{ label: '살게요 (조개 10)', value: 'buyBerry' }, { label: '괜찮아요', value: 'no' }] },
        ];
      case 'fisher':
        return [
          { who: '도윤 아저씨', text: '바람이 없으니 배를 띄울 수가 있나. 게들만 신났지.' },
          { who: '도윤 아저씨', text: '해변 동쪽 끝 바위 사이에 누가 상자를 묻어 뒀더라고. 반짝 조개가 가득하던데?' },
        ];
      case 'kid':
        if (!this.inv.has('starShard')) return [{ who: '꼬마 모래', text: '갈매기 절벽 서쪽 끝에서 별이 떨어지는 걸 봤어! 진짜야!' }, { who: '꼬마 모래', text: '나는 무서워서 못 가. 형아… 아니 누나? 아무튼 대신 가 줘!' }];
        return [{ who: '꼬마 모래', text: '우와, 진짜 별 조각이다! 반짝반짝해!' }];
    }
    return [];
  }
  toJSON() { return [...this.flags]; }
  load(a: string[]) { this.flags = new Set(a ?? []); events.emit('quest'); }
}
