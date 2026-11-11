/** Shared attack timing so animation poses and hit windows always line up. Times in seconds. */
export interface AttackDef { name: string; dur: number; hit0: number; hit1: number; reach: number; arc: number; dmg: number; lunge: number; comboWindow: number; }
export const ATTACKS: AttackDef[] = [
  { name: 'slashA', dur: 0.4, hit0: 0.1, hit1: 0.22, reach: 1.9, arc: 1.9, dmg: 1, lunge: 3.2, comboWindow: 0.24 },
  { name: 'slashB', dur: 0.4, hit0: 0.1, hit1: 0.22, reach: 1.9, arc: 1.9, dmg: 1, lunge: 3.2, comboWindow: 0.24 },
  { name: 'spin', dur: 0.62, hit0: 0.12, hit1: 0.4, reach: 2.3, arc: Math.PI * 2, dmg: 2, lunge: 1.5, comboWindow: 0 },
];
export const JUMP_ATTACK: AttackDef = { name: 'jumpSlash', dur: 0.5, hit0: 0.12, hit1: 0.3, reach: 2.1, arc: 2.2, dmg: 2, lunge: 4, comboWindow: 0 };
export const ROLL_TIME = 0.48;
export const HIT_TIME = 0.42;
