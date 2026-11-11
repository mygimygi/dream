/** localStorage persistence. Wrapped in try/catch so a blocked storage never breaks the game. */
const KEY = 'wave-isle-save-v1';
const SKEY = 'wave-isle-settings-v1';
export interface SaveData {
  v: 1; time: number; pos: [number, number, number]; yaw: number; area: 'island' | 'dungeon'; hp: number;
  inventory: any; flags: string[]; chests: string[]; bushes: number[]; pots: number[]; dungeon: { torches: boolean[]; block: [number, number]; doorC: boolean; bossDead: boolean; keyChest: boolean };
  playTime: number; starShards?: number; appearance?: any; name?: string;
}
export interface Settings { quality: 'auto' | 'low' | 'medium' | 'high'; music: number; sfx: number; sens: number; shake: boolean; }
export const DEFAULT_SETTINGS: Settings = { quality: 'auto', music: 0.6, sfx: 0.8, sens: 1, shake: true };
export const Save = {
  write(d: SaveData) { try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch { return false; } },
  read(): SaveData | null { try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch { return null; } },
  clear() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } },
  settings(): Settings { try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SKEY) || '{}') }; } catch { return { ...DEFAULT_SETTINGS }; } },
  writeSettings(s: Settings) { try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch { /* ignore */ } },
};
