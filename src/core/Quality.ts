export type QualityLevel = 'low' | 'medium' | 'high';
export interface QualityProfile {
  level: QualityLevel; pixelRatio: number; shadowSize: number; shadows: boolean; ao: boolean; bloom: boolean;
  tiltShift: boolean; grassCount: number; flowerCount: number; antialias: 'smaa' | 'fxaa' | 'none';
}
export const PROFILES: Record<QualityLevel, Omit<QualityProfile, 'level'>> = {
  low: { pixelRatio: 1, shadowSize: 1024, shadows: true, ao: false, bloom: false, tiltShift: false, grassCount: 9000, flowerCount: 700, antialias: 'fxaa' },
  medium: { pixelRatio: 1.25, shadowSize: 2048, shadows: true, ao: false, bloom: true, tiltShift: true, grassCount: 22000, flowerCount: 1400, antialias: 'smaa' },
  high: { pixelRatio: 2, shadowSize: 4096, shadows: true, ao: true, bloom: true, tiltShift: true, grassCount: 42000, flowerCount: 2200, antialias: 'smaa' },
};
export function detectQuality(): QualityLevel {
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (matchMedia('(pointer:coarse)').matches && innerWidth < 1100);
  const cores = navigator.hardwareConcurrency || 4;
  if (mobile) return cores >= 8 ? 'medium' : 'low';
  return cores >= 8 ? 'high' : 'medium';
}
export function profile(level: QualityLevel): QualityProfile {
  const p = PROFILES[level];
  return { level, ...p, pixelRatio: Math.min(p.pixelRatio, window.devicePixelRatio || 1) };
}
