/** localStorage persistence. Wrapped in try/catch so a blocked storage never breaks the game. */
const KEY = 'wave-isle-save-v1';
const SKEY = 'wave-isle-settings-v1';
export interface SaveData {
  v: 1 | 2; time: number; pos: [number, number, number]; yaw: number; area: 'island' | 'dungeon' | 'grove' | 'sky'; hp: number;
  inventory: any; flags: string[]; chests: string[]; bushes: number[]; pots: number[]; dungeon: { torches: boolean[]; block: [number, number]; doorC: boolean; bossDead: boolean; keyChest: boolean };
  playTime: number; starShards?: number; appearance?: any; name?: string; v2?: any;
}
export interface Settings { quality: 'auto' | 'low' | 'medium' | 'high'; music: number; sfx: number; sens: number; shake: boolean; }
export const DEFAULT_SETTINGS: Settings = { quality: 'auto', music: 0.6, sfx: 0.8, sens: 1, shake: true };
export const Save = {
  /** serialise first, keep the previous save as a backup, then write: a failed write never destroys the old data */
  write(d: SaveData) {
    let json: string; try { json = JSON.stringify(d); } catch { return false; }
    try { const prev = localStorage.getItem(KEY); if (prev) localStorage.setItem(KEY + '-backup', prev); localStorage.setItem(KEY, json); return true; } catch { return false; }
  },
  read(): SaveData | null {
    for (const k of [KEY, KEY + '-backup']) { try { const s = localStorage.getItem(k); if (s) { const d = JSON.parse(s); if (d && d.pos && d.inventory) return d; } } catch { /* corrupt: fall back to backup */ } }
    return null;
  },
  clear() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } },
  settings(): Settings { try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SKEY) || '{}') }; } catch { return { ...DEFAULT_SETTINGS }; } },
  writeSettings(s: Settings) { try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch { /* ignore */ } },
};
