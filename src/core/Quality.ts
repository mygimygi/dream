export type QualityLevel = 'low' | 'medium' | 'high';
export interface QualityProfile {
  level: QualityLevel; pixelRatio: number; shadowSize: number; shadows: boolean; ao: boolean; bloom: boolean;
  tiltShift: boolean; grassCount: number; flowerCount: number; antialias: 'smaa' | 'fxaa' | 'none';
}
export const PROFILES: Record<QualityLevel, Omit<QualityProfile, 'level'>> = {
  low: { pixelRatio: 1, shadowSize: 1024, shadows: true, ao: false, bloom: false, tiltShift: false, grassCount: 6000, flowerCount: 500, antialias: 'none' },
  medium: { pixelRatio: 1.5, shadowSize: 2048, shadows: true, ao: false, bloom: true, tiltShift: true, grassCount: 22000, flowerCount: 1400, antialias: 'smaa' },
  high: { pixelRatio: 2, shadowSize: 4096, shadows: true, ao: true, bloom: true, tiltShift: true, grassCount: 42000, flowerCount: 2200, antialias: 'smaa' },
};
/** GPU name (when the browser exposes it) */
export function gpuName(): string {
  try {
    const c = document.createElement('canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
    (gl.getExtension('WEBGL_lose_context') as any)?.loseContext();
    return name;
  } catch { return ''; }
}
export function isMobile() { return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (matchMedia('(pointer:coarse)').matches && innerWidth < 1100); }
/** Pick a starting profile from device class, GPU family, memory and core count (refined at runtime by the fps check). */
export function detectQuality(): QualityLevel {
  const mobile = isMobile();
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as any).deviceMemory ?? 8;
  const gpu = gpuName();
  const weakGpu = /Mali-(4|T[0-8])|Mali-G(31|51|52|57|68)|Adreno \(TM\) ?[1-6]\d\d|PowerVR|SwiftShader|llvmpipe|Intel.*HD Graphics [2-5]\d{2,3}/i.test(gpu);
  const strongMobile = /Apple GPU|Adreno \(TM\) ?7[3-9]\d|Adreno.*8\d\d|Mali-G7[1-9]\d|Immortalis/i.test(gpu);
  if (mobile) return weakGpu || mem <= 4 || cores < 6 ? 'low' : strongMobile && mem >= 6 ? 'medium' : 'low';
  if (weakGpu) return 'low';
  return cores >= 8 && mem >= 8 ? 'high' : 'medium';
}
export function profile(level: QualityLevel): QualityProfile {
  const p = PROFILES[level];
  // phones: never render above 1.5x even on 3x screens (fill-rate is the bottleneck)
  const cap = isMobile() ? Math.min(1.5, p.pixelRatio) : p.pixelRatio;
  return { level, ...p, pixelRatio: Math.min(cap, window.devicePixelRatio || 1) };
}
