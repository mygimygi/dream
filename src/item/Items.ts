import * as THREE from 'three';
import { toy } from '../render/Materials';
import { shieldModel, swordModel } from '../character/Humanoid';
import { at, colorize, cyl, gradient, lathe, merge, rbox, sphere } from '../world/Geo';

export type ItemKind = 'weapon' | 'shield' | 'armor' | 'tool' | 'consumable' | 'upgrade' | 'key' | 'quest' | 'currency' | 'treasure';
export interface ItemDef { id: string; name: string; desc: string; kind: ItemKind; stack?: boolean;
  dmg?: number; reach?: number; hearts?: number; guardArc?: number; tier?: number; }
export const ITEMS: Record<string, ItemDef> = {
  sword: { id: 'sword', name: '산호검', kind: 'weapon', dmg: 1, tier: 1, desc: '바닷가 산호목을 깎아 만든 가벼운 검. 공격을 이어 누르면 세 번째 타격이 회전 베기가 된다.' },
  steelSword: { id: 'steelSword', name: '푸른 강철검', kind: 'weapon', dmg: 2, tier: 2, desc: '대장장이 바위가 벼린 푸른빛 강철검. 공격력이 산호검의 두 배.' },
  whaleSword: { id: 'whaleSword', name: '고래뼈 대검', kind: 'weapon', dmg: 3, reach: 0.4, tier: 3, desc: '바다에 떠밀려 온 고래뼈를 깎은 대검. 공격력이 가장 높고 칼날이 길어 더 멀리 닿는다.' },
  turtleShield: { id: 'turtleShield', name: '거북 등껍질 방패', kind: 'shield', guardArc: 1.75, desc: '넓고 단단한 거북 등껍질 방패. 더 넓은 각도의 공격을 막고 밀려나는 힘이 줄어든다.' },
  leatherVest: { id: 'leatherVest', name: '가죽 조끼', kind: 'armor', hearts: 1, desc: '질긴 가죽으로 만든 조끼. 입고 있으면 최대 체력이 하트 1칸 늘어난다.' },
  shellArmor: { id: 'shellArmor', name: '조개껍데기 갑옷', kind: 'armor', hearts: 2, desc: '커다란 조개껍데기를 이어 붙인 갑옷. 입고 있으면 최대 체력이 하트 2칸 늘어난다.' },
  shield: { id: 'shield', name: '소라 방패', kind: 'shield', guardArc: 1.25, desc: '소라 껍데기 문양이 새겨진 둥근 방패. 방어 중에는 정면 공격을 막는다.' },
  lantern: { id: 'lantern', name: '바다불 등불', kind: 'tool', desc: '꺼지지 않는 푸른 불. 도구로 쓰면 앞쪽 횃불에 불을 붙이고, 어두운 동굴을 밝혀 준다.' },
  berry: { id: 'berry', name: '회복 열매', kind: 'consumable', stack: true, desc: '새콤달콤한 섬 열매. 먹으면 하트 3칸을 회복한다.' },
  heartContainer: { id: 'heartContainer', name: '하트 그릇', kind: 'upgrade', desc: '최대 체력이 하트 1칸 늘어나고 체력이 모두 회복된다.' },
  smallKey: { id: 'smallKey', name: '작은 열쇠', kind: 'key', stack: true, desc: '물빛 동굴의 잠긴 문 하나를 열 수 있다.' },
  moonPearl: { id: 'moonPearl', name: '달진주', kind: 'quest', desc: '은은하게 빛나는 큰 진주. 달빛 사원의 제단에 바쳐야 한다.' },
  shell: { id: 'shell', name: '반짝 조개', kind: 'currency', stack: true, desc: '섬에서 돈처럼 쓰이는 반짝이는 조개껍데기.' },
  starShard: { id: 'starShard', name: '별 조각', kind: 'treasure', desc: '하늘에서 떨어졌다는 별빛 조각. 모으면 좋은 일이 생긴다는 소문이 있다.' },
  heart: { id: 'heart', name: '하트', kind: 'consumable', desc: '체력 1칸 회복' },
};

const itemMat = toy({ vertexColors: true, roughness: 0.4 }, { rim: 0.4 });
const glowMat = (c: number, i = 1.6) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.3 });

function heartGeo() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.28); s.bezierCurveTo(-0.08, -0.18, -0.32, -0.05, -0.3, 0.1); s.bezierCurveTo(-0.28, 0.27, -0.06, 0.3, 0, 0.14);
  s.bezierCurveTo(0.06, 0.3, 0.28, 0.27, 0.3, 0.1); s.bezierCurveTo(0.32, -0.05, 0.08, -0.18, 0, -0.28);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 4, curveSegments: 16 });
  g.center();
  return g;
}
function starGeo(r = 0.3) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 2, rr = i % 2 ? r * 0.45 : r; i ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 3 }); g.center(); return g;
}
function shellGeo() {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const a = -1.0 + (i / 6) * 2.0;
    parts.push(at(cyl(0.035, 0.05, 0.36, 8), Math.sin(a) * 0.15, Math.cos(a) * 0.15, 0, 0, 0, -a, [1, 1, 0.6]));
  }
  parts.push(at(sphere(0.07, 10, 8), 0, -0.02, 0, 0, 0, 0, [1.4, 0.8, 0.6]));
  const g = merge(parts); gradient(g, 0xf3b0a0, 0xfff1e6, -0.1, 0.35); return g;
}

export function itemModel(id: string): THREE.Object3D {
  const g = new THREE.Group();
  const M = (geo: THREE.BufferGeometry, m: THREE.Material = itemMat) => { const o = new THREE.Mesh(geo, m); o.castShadow = true; g.add(o); return o; };
  switch (id) {
    case 'sword': case 'steelSword': case 'whaleSword': { const s = swordModel(ITEMS[id].tier); s.scale.setScalar(1.3); s.rotation.z = -0.6; s.position.y = -0.3; g.add(s); break; }
    case 'shield': case 'turtleShield': { const s = shieldModel(id); s.scale.setScalar(1.6); g.add(s); break; }
    case 'leatherVest': case 'shellArmor': {
      const shell = id === 'shellArmor';
      const v = lathe([[0.0, 0.0], [0.3, 0.0], [0.34, 0.2], [0.33, 0.45], [0.26, 0.6], [0.0, 0.6]], 24);
      if (shell) gradient(v, 0xd8a090, 0xfff0e6, 0, 0.6); else colorize(v, 0x9a6a3e, 0.15, 3);
      M(at(v, 0, -0.3, 0));
      M(colorize(at(new THREE.TorusGeometry(0.34, 0.03, 6, 22), 0, -0.05, 0, Math.PI / 2, 0, 0), shell ? 0xe8b8a8 : 0x5a3a22));
      if (shell) for (const sg of [-1, 1]) M(gradient(at(sphere(0.15, 14, 10), sg * 0.33, 0.25, 0, 0, 0, sg * 0.3, [1.1, 0.6, 1]), 0xd8a090, 0xfff0e6, 0.2, 0.32));
      break;
    }
    case 'lantern': {
      M(colorize(lathe([[0, 0], [0.16, 0], [0.18, 0.04], [0.12, 0.08], [0, 0.08]], 14), 0x6a5a48));
      M(colorize(at(lathe([[0, 0], [0.17, 0], [0.19, 0.04], [0.1, 0.1], [0.04, 0.14], [0, 0.15]], 14), 0, 0.42, 0), 0x6a5a48));
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; M(colorize(at(cyl(0.015, 0.015, 0.36, 5), Math.cos(a) * 0.15, 0.25, Math.sin(a) * 0.15), 0x6a5a48)); }
      M(colorize(at(new THREE.TorusGeometry(0.08, 0.018, 6, 14), 0, 0.62, 0), 0x6a5a48));
      M(at(sphere(0.11, 14, 10), 0, 0.25, 0, 0, 0, 0, [1, 1.35, 1]), glowMat(0x6fe0ff, 2.4));
      g.position.y = -0.25;
      break;
    }
    case 'berry': {
      const parts: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 5; i++) { const a = i * 1.26; parts.push(colorize(at(sphere(0.1, 12, 10), Math.cos(a) * 0.09, (i % 2) * 0.06, Math.sin(a) * 0.09), 0xe8405a)); }
      parts.push(colorize(at(sphere(0.1, 12, 10), 0, 0.12, 0), 0xf05a70));
      parts.push(colorize(at(sphere(0.09, 8, 6), 0.05, 0.25, 0, 0, 0, 0.6, [1.6, 0.3, 0.8]), 0x5aa83a));
      M(merge(parts)); break;
    }
    case 'heart': case 'heartContainer': {
      M(colorize(heartGeo(), 0xf0485a));
      if (id === 'heartContainer') { const r = M(colorize(at(new THREE.TorusGeometry(0.4, 0.04, 8, 30), 0, 0, 0), 0xf2c94c)); r.material = toy({ vertexColors: true, metalness: 0.6, roughness: 0.3 }, { rim: 0.3 }); }
      break;
    }
    case 'smallKey': {
      const k = merge([at(new THREE.TorusGeometry(0.11, 0.035, 8, 18), 0, 0.2, 0), at(cyl(0.03, 0.03, 0.36, 8), 0, -0.07, 0), at(rbox(0.1, 0.05, 0.04, 0.01), 0.05, -0.2, 0), at(rbox(0.07, 0.05, 0.04, 0.01), 0.04, -0.11, 0)]);
      const o = M(colorize(k, 0xf2c94c)); o.material = toy({ vertexColors: true, metalness: 0.7, roughness: 0.28 }, { rim: 0.35 }); break;
    }
    case 'moonPearl': {
      M(at(sphere(0.26, 28, 20), 0, 0.12, 0), new THREE.MeshPhysicalMaterial({ color: 0xf6f0ff, emissive: 0xbfd8ff, emissiveIntensity: 0.9, roughness: 0.12, clearcoat: 1, sheen: 1, sheenColor: new THREE.Color(0xffc8f0) }));
      M(colorize(at(shellGeo(), 0, -0.1, 0, -1.2, 0, 0, [1.4, 1.4, 1.4]), 0xffffff));
      break;
    }
    case 'shell': { M(shellGeo()); break; }
    case 'starShard': { M(starGeo(), glowMat(0xffd84a, 1.4)); break; }
  }
  return g;
}

/** Renders each item model to a small transparent image for the UI (consistent 3D icons). */
export function renderIcons(renderer: THREE.WebGLRenderer, ids: string[], size = 128): Record<string, string> {
  const out: Record<string, string> = {};
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a6a, 2.2));
  const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(2, 3, 4); scene.add(d);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20); cam.position.set(0, 0.25, 2.4); cam.lookAt(0, 0, 0);
  const rt = new THREE.WebGLRenderTarget(size, size, { colorSpace: THREE.SRGBColorSpace });
  const buf = new Uint8Array(size * size * 4);
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const prevTM = renderer.toneMapping, prevTarget = renderer.getRenderTarget(), prevClear = renderer.getClearAlpha();
  renderer.toneMapping = THREE.NoToneMapping;
  for (const id of ids) {
    const m = itemModel(id);
    const box = new THREE.Box3().setFromObject(m);
    const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    const k = 0.85 / Math.max(s.x, s.y, s.z * 0.7);
    m.scale.multiplyScalar(k); m.position.sub(c.multiplyScalar(k));
    const piv = new THREE.Group(); piv.add(m); piv.rotation.set(0.15, -0.5, 0);
    if (id === 'sword') piv.rotation.set(0, 0, 0.2);
    if (id === 'shield' || id === 'heart' || id === 'heartContainer' || id === 'starShard') piv.rotation.set(0.1, -0.25, 0);
    scene.add(piv);
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear();
    renderer.render(scene, cam);
    renderer.readRenderTargetPixels(rt, 0, 0, size, size, buf);
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) img.data.set(buf.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
    ctx.clearRect(0, 0, size, size); ctx.putImageData(img, 0, 0);
    out[id] = canvas.toDataURL('image/png');
    scene.remove(piv);
  }
  renderer.toneMapping = prevTM; renderer.setRenderTarget(prevTarget); renderer.setClearAlpha(prevClear);
  rt.dispose();
  return out;
}
