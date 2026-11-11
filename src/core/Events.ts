type Handler = (payload?: any) => void;
// Minimal pub/sub used to decouple gameplay systems from UI, audio and save.
export class Events {
  private map = new Map<string, Set<Handler>>();
  on(type: string, fn: Handler) { if (!this.map.has(type)) this.map.set(type, new Set()); this.map.get(type)!.add(fn); return () => this.off(type, fn); }
  off(type: string, fn: Handler) { this.map.get(type)?.delete(fn); }
  emit(type: string, payload?: any) { this.map.get(type)?.forEach((fn) => fn(payload)); }
}
export const events = new Events();
