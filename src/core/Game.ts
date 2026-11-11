import * as THREE from 'three';
import { RenderSystem } from '../render/Renderer';
import { U, TOY } from '../render/Materials';
import { Particles } from '../render/Particles';
import { World, ChestEnt } from '../world/World';
import { REGION_NAMES, Region, WORLD_HALF } from '../world/Heightfield';
import * as L from '../world/Layout';
import { chest as chestModel } from '../world/Props';
import * as PropsMod from '../world/Props';
import { CameraRig } from '../camera/CameraRig';
import { Player } from '../character/Player';
import { NPC } from '../character/NPC';
import { Enemy, EnemyType, Projectile } from '../enemy/Enemy';
import { Input } from './Input';
import { events } from './Events';
import { detectQuality, profile, QualityLevel } from './Quality';
import { clamp, damp, angleDiff } from './math';
import { Inventory } from '../inventory/Inventory';
import { Quest } from '../quest/Quest';
import { ITEMS, itemModel, renderIcons } from '../item/Items';
import { UIExt } from '../ui/UIExt';
import { TimeWeather } from '../systems/TimeWeather';
import { QuestManager } from '../systems/Quests';
import { Codex } from '../systems/Codex';
import { Exploration } from '../systems/Exploration';
import { Tools } from '../systems/Tools';
import { Fishing } from '../systems/Fishing';
import { Cooking } from '../systems/Cooking';
import { Minigames } from '../systems/Minigames';
import { Mount } from '../systems/Mount';
import { NPCLife } from '../systems/NPCLife';
import { buildArenas } from '../systems/Arenas';
import { GROVE, SKY } from '../data/places';
import { SECRET_PLACES } from '../systems/Codex';
import { Minimap } from '../ui/Minimap';
import { AudioSystem } from '../audio/Audio';
import { Save, SaveData, Settings } from '../save/Save';
import { TouchControls } from '../mobile/TouchControls';
import { Dungeon, DUNGEON_ENTRY, DX, ROOMS } from '../dungeon/Dungeon';
import { Gate, Plate, PushBlock } from '../puzzle/Puzzles';
import * as PlacesMod from '../data/places';
import { Fullscreen } from '../mobile/Fullscreen';
import { HERO_LOOK, HumanoidLook } from '../character/Humanoid';

const HAIR: Record<string, [number, number, string]> = { auburn: [0xa8482a, 0xe07b45, '적갈색'], black: [0x2a2220, 0x4a3a34, '검정'], blond: [0xd8a840, 0xf6d878, '금발'], brown: [0x6a4228, 0x9a6a44, '갈색'], pink: [0xe07a9a, 0xffb0c8, '분홍'], teal: [0x3a8a9a, 0x6ac8d0, '청록'], silver: [0xb8b8c4, 0xffffff, '은발'] };
const SKIN: Record<string, number> = { s1: 0xffe0c8, s2: 0xffd2b0, s3: 0xf0b890, s4: 0xd89a70, s5: 0xb07850, s6: 0x7a5038 };
const EYE: Record<string, number> = { brown: 0x3a2a24, blue: 0x2a5a9a, green: 0x2a7a4a, amber: 0x9a5a1a };
const OUTFIT: Record<string, { tunic: number; tunicHi: number; cape: number; scarf: number; label: string }> = {
  teal: { tunic: 0x2f9e94, tunicHi: 0x55c2b2, cape: 0x237a78, scarf: 0xf08a3a, label: '청록' },
  crimson: { tunic: 0xc8453a, tunicHi: 0xe8705a, cape: 0x8a2a2a, scarf: 0xf2c94c, label: '진홍' },
  forest: { tunic: 0x4f8f3a, tunicHi: 0x7ab85a, cape: 0x3a6a2a, scarf: 0xe8d8a0, label: '숲' },
  ocean: { tunic: 0x3a6ac8, tunicHi: 0x6a9ae8, cape: 0x2a4a8a, scarf: 0xf0f0f0, label: '바다' },
  plum: { tunic: 0x8a5ab8, tunicHi: 0xaa80d8, cape: 0x5a3a8a, scarf: 0xf0a0c0, label: '보라' },
  sun: { tunic: 0xe8a23a, tunicHi: 0xf6c860, cape: 0xb8702a, scarf: 0x3a8a9a, label: '해바라기' },
};
export interface Appearance { gender: 'f' | 'm'; hair: string; style: string; skin: string; eye: string; eyeSize: string; outfit: string; }
export const DEFAULT_APPEARANCE: Appearance = { gender: 'f', hair: 'auburn', style: 'hero', skin: 's2', eye: 'brown', eyeSize: '1', outfit: 'teal' };
export function lookFrom(a: Appearance): HumanoidLook {
  const h = HAIR[a.hair] ?? HAIR.auburn, o = OUTFIT[a.outfit] ?? OUTFIT.teal;
  return { ...HERO_LOOK, hair: h[0], hairHi: h[1], skin: SKIN[a.skin] ?? SKIN.s2, eye: EYE[a.eye] ?? EYE.brown, eyeScale: +a.eyeSize || 1,
    hairStyle: a.style as HumanoidLook['hairStyle'], lashes: a.gender === 'f', tunic: o.tunic, tunicHi: o.tunicHi, cape: o.cape, scarf: o.scarf };
}

type Mode = 'title' | 'create' | 'play' | 'itemget' | 'dead' | 'ending' | 'transition';
interface Pickup { obj: THREE.Object3D; id: string; pos: THREE.Vector3; vel: THREE.Vector3; t: number; big: boolean; count: number; }

export class Game {
  scene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(25, innerWidth / innerHeight, 0.3, 900);
  rs: RenderSystem; world: World; rig: CameraRig; input: Input; player: Player; inv = new Inventory(); quest: Quest;
  ui = new UIExt(); audio = new AudioSystem(); particles: Particles; minimap: Minimap; touch: TouchControls; dungeon: Dungeon;
  npcs: NPC[] = []; enemies: Enemy[] = []; shots: Projectile[] = []; pickups: Pickup[] = [];
  chests = new Map<string, ChestEnt>();
  ruinsBlock: PushBlock; ruinsPlate: Plate; ruinsGate: Gate;
  mode: Mode = 'title'; time = 0; playTime = 0; hitstop = 0; area: 'island' | 'dungeon' | 'grove' | 'sky' = 'island';
  events = events;
  time_!: TimeWeather; qm!: QuestManager; codex = new Codex(); explore!: Exploration; tools!: Tools; fishing!: Fishing; cooking!: Cooking;
  minigames!: Minigames; mount!: Mount; life!: NPCLife; relations: Record<string, number> = {};
  arenas!: ReturnType<typeof buildArenas>; discovered = new Uint8Array(64 * 64); private markers: THREE.Sprite[] = [];
  private nightMoths: Enemy[] = []; private finalBoss: Enemy | null = null; private arenaBoss: Enemy | null = null;
  settings: Settings; qLevel: QualityLevel;
  private region: Region | '' = ''; private lastFrame = performance.now(); private fpsAcc: number[] = []; private autoChecked = false;
  private itemGetT = 0; private pendingItem: { id: string; count: number } | null = null; private deadT = 0;
  private lantern: THREE.PointLight; private interactTarget: { label: string; act: () => void } | null = null;
  private boss: Enemy | null = null; private altarPearl: THREE.Object3D | null = null; private beam: THREE.Mesh | null = null;
  private respawnTimers: { type: EnemyType; x: number; z: number; t: number }[] = [];
  private guideMesh: THREE.Mesh;
  appearance: Appearance = { ...DEFAULT_APPEARANCE }; playerName = '미루'; private createYaw = 0;
  private dayT = 0.32; private fsKeyHeld = false;

  constructor(canvas: HTMLCanvasElement) {
    this.settings = Save.settings();
    const urlQ = new URLSearchParams(location.search).get('q') as QualityLevel | null;
    this.qLevel = urlQ ?? (this.settings.quality === 'auto' ? detectQuality() : this.settings.quality);
    const q = profile(this.qLevel);
    this.rs = new RenderSystem(canvas, this.scene, this.cam);
    TOY.gloss = q.level === 'low' ? 0 : 1;
    this.world = new World(this.scene, q, this.rs.renderer);
    this.rs.setQuality(q);
    this.input = new Input(canvas);
    this.rig = new CameraRig(this.cam, (x, z) => this.groundAt(x, z));
    this.rig.sensitivity = this.settings.sens;
    this.quest = new Quest(this.inv);
    this.particles = new Particles(this.scene);
    this.dungeon = new Dungeon(this.scene, this.world.col);
    this.player = new Player(this.scene, {
      groundAt: (x, z, m) => this.groundAt(x, z, m), terrainAt: (x, z) => this.world.hf.height(x, z), col: this.world.col, dungeon: () => this.area === 'dungeon',
    }, this.input, this.rig, this.inv);
    // floating guide beacon (downward arrow) shown above the current objective
    const gShape = new THREE.Shape(); gShape.moveTo(0, -0.7); gShape.lineTo(0.6, 0); gShape.lineTo(0.25, 0); gShape.lineTo(0.25, 0.6); gShape.lineTo(-0.25, 0.6); gShape.lineTo(-0.25, 0); gShape.lineTo(-0.6, 0); gShape.closePath();
    const gGeo = new THREE.ExtrudeGeometry(gShape, { depth: 0.22, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2 }); gGeo.center();
    this.guideMesh = new THREE.Mesh(gGeo, new THREE.MeshStandardMaterial({ color: 0xff8a5a, emissive: 0xff6a30, emissiveIntensity: 1.4, roughness: 0.4 }));
    this.guideMesh.visible = false; this.scene.add(this.guideMesh);
    this.lantern = new THREE.PointLight(0x9fe8ff, 0, 13, 1.4); this.scene.add(this.lantern);
    this.minimap = new Minimap(this.world.hf);
    this.ui.minimapCanvas(this.minimap.canvas);
    this.touch = new TouchControls(this.input, this.ui.root, canvas);
    this.ui.setIcons(renderIcons(this.rs.renderer, Object.keys(ITEMS)));
    this.ui.sfx = (n) => this.audio.play(n);
    this.audio.setVolumes(this.settings.music, this.settings.sfx);

    // chests
    for (const def of L.CHESTS) {
      const obj = chestModel(def.big);
      const y = def.dungeon ? 0 : this.world.hf.height(def.x, def.z);
      obj.position.set(def.x, y, def.z); obj.rotation.y = def.yaw;
      this.scene.add(obj);
      const col = this.world.col.box(def.x, def.z, 0.75 * (def.big ? 1.25 : 1), 0.5 * (def.big ? 1.25 : 1), -def.yaw, y - 1, y + 1.1);
      const ent: ChestEnt = { def, obj, opened: false, openT: 0, collider: col, visible: !def.hidden };
      if (def.hidden) { obj.visible = false; col.active = false; }
      this.chests.set(def.id, ent);
    }
    // NPCs
    for (const n of L.NPCS) {
      const npc = new NPC(this.scene, n.id, n.name, n.x, n.z, this.world.hf.height(n.x, n.z));
      this.npcs.push(npc); npc.collider = this.world.col.add({ kind: 'circle', x: n.x, z: n.z, r: 0.45, hx: 0.45, hz: 0.45, rot: 0, y0: -5, y1: 5, solid: true, walkTop: false, active: true }, true);
    }
    // ruins puzzle
    const P = L.RUINS_PUZZLE;
    this.ruinsBlock = new PushBlock(this.scene, this.world.col, P.block.x, P.block.z, (x, z) => this.world.hf.height(x, z), 'ruins');
    this.ruinsPlate = new Plate(this.scene, P.plate.x, P.plate.z, this.world.hf.height(P.plate.x, P.plate.z));
    this.ruinsGate = new Gate(this.scene, this.world.col, P.gate.x, P.gate.z, this.world.hf.height(P.gate.x, P.gate.z) - 0.2, P.gate.yaw, 3.6);
    this.world.onSign = (text) => this.say([{ who: '', text: text.replace(/\n/g, ' · ') }]);
    (this.world as any).glassMat = (this.world.scene.getObjectByName('props') ? undefined : undefined);
    { const { MAT } = PropsMod; (this.world as any).glassMat = MAT.glass; }
    this.time_ = new TimeWeather(this); this.qm = new QuestManager(this);
    this.explore = new Exploration(this); this.tools = new Tools(this); this.fishing = new Fishing(this); this.cooking = new Cooking(this);
    this.minigames = new Minigames(this); this.mount = new Mount(this); this.life = new NPCLife(this);
    this.arenas = buildArenas(this.scene, this.world.col);
    this.codex.where = () => this.area === 'island' ? REGION_NAMES[this.world.hf.regionAt(this.player.pos.x, this.player.pos.z)] : this.area === 'dungeon' ? '물빛 동굴' : this.area === 'grove' ? SECRET_PLACES.grove : SECRET_PLACES.skyIsle;
    for (const n of this.npcs) { const sp = this.markerSprite(); n.rig.root.add(sp); sp.position.y = 2.15; this.markers.push(sp); }
    this.wireEvents();
    this.wireUI();
    const onResize = () => { this.rs.resize(); this.particles.setScale(innerHeight); };
    addEventListener('resize', onResize);
    Fullscreen.onChange(() => { this.ui.setFullscreenState(Fullscreen.active(), Fullscreen.supported()); setTimeout(onResize, 120); });
    this.ui.setFullscreenState(false, Fullscreen.supported());
    this.particles.setScale(innerHeight);
    (window as any).__game = this;
    this.toTitle();
    requestAnimationFrame(() => this.loop());
  }

  groundAt(x: number, z: number, maxY = Infinity) {
    if (x > 500) { const t = this.world.col.topAt(x, z, maxY); return t === -Infinity ? -6 : t; }
    return this.world.groundAt(x, z, maxY);
  }

  // ------------------------------------------------------------------ events
  private wireEvents() {
    events.on('sfx', (n) => this.audio.play(n));
    events.on('toast', (t) => this.ui.toast(t));
    events.on('questsChanged', () => this.updateMarkers());
    events.on('summon', (s) => { const e = this.spawn(s.type, s.x, s.z); this.particles.poof(e.pos.clone().setY(e.pos.y + 1)); });
    events.on('codexNew', ({ cat, id }) => { if (cat === 'places') return; const name = cat === 'monsters' ? '몬스터' : cat === 'fish' ? '물고기' : '도감'; this.ui.toast(`📖 ${name} 도감에 새로 기록됐어요`); void id; });
    events.on('inventory', () => { for (const id of this.inv.list()) this.codex.seeItem(id); });
    events.on('step', (p) => { this.audio.play('step', { water: p.water }); if (p.water) this.particles.splash(p.pos.clone().setY(p.pos.y + 0.1)); else if (Math.random() < 0.4) this.particles.dust(p.pos.clone().setY(p.pos.y + 0.05), 2); });
    events.on('dust', (p) => this.particles.dust(p.clone().setY(p.y + 0.1), 10));
    events.on('splash', (p) => { this.particles.splash(p); this.audio.play('splash'); });
    events.on('shake', (a) => this.shake(a));
    events.on('blocked', (p) => this.particles.hit(p));
    events.on('jumpSlam', (p) => this.slam(p));
    events.on('playerDead', () => { this.mode = 'dead'; this.deadT = 0; });
    events.on('inventory', () => this.ui.equip(this.inv, this.touch.enabled));
    events.on('quest', () => { const o = this.quest.objective(); this.ui.quest(o.title, o.hint); this.updateMarkers(); });
    events.on('bossWall', (p) => { this.particles.poof(p.clone().setY(p.y + 1), 0xe8e0d0); });
    events.on('enemyGone', (e: Enemy) => {
      this.enemies = this.enemies.filter((x) => x !== e);
      if (this.area === 'island' && e.type !== 'boss') this.respawnTimers.push({ type: e.type, x: e.home.x, z: e.home.z, t: 75 });
      if (this.area === 'dungeon') this.checkRoomClear();
    });
  }
  private wireUI() {
    const ui = this.ui;
    ui.onMenu = (a) => {
      switch (a) {
        case 'new': this.audio.unlock(); Fullscreen.enter(); this.openCreator(); break;
        case 'continue': this.audio.unlock(); Fullscreen.enter(); this.continueGame(); break;
        case 'fullscreen': Fullscreen.toggle(); if (ui.panelOpen === 'pause') ui.closePanel(); break;
        case 'settings': ui.settings(this.settings); break;
        case 'help': ui.help(this.touch.enabled); break;
        case 'back': if (this.mode === 'title') ui.closePanel(); else ui.pause(); break;
        case 'close': ui.closePanel(); break;
        case 'pause': if (this.mode !== 'title') ui.pause(); break;
        case 'inventory': if (this.mode !== 'title') this.openInventory(); break;
        case 'map': if (this.mode !== 'title') this.openMap(); break;
        case 'quests': this.ui.questLog(this.qm); break;
        case 'codex': this.ui.codexView(this.codex, 'fish', this.fishing.records); break;
        case 'recipes': this.ui.recipes(this.cooking.known); break;
        case 'save': this.save(); ui.toast('저장했어요'); ui.closePanel(); break;
        case 'toTitle': ui.closePanel(); this.save(); this.toTitle(); break;
        case 'free': this.mode = 'play'; break;
        case 'retry': ui.closePanel(); this.respawn(); break;
      }
    };
    ui.onSettings = (s) => {
      const qChanged = s.quality !== this.settings.quality;
      this.settings = s; Save.writeSettings(s);
      this.audio.setVolumes(s.music, s.sfx); this.rig.sensitivity = s.sens;
      if (qChanged) { this.qLevel = s.quality === 'auto' ? detectQuality() : s.quality; this.rs.setQuality(profile(this.qLevel)); }
    };
    ui.onEquip = (id) => this.inv.equip(id);
    ui.onUse = (id) => this.useItem(id);
    ui.onMapTeleport = (i) => this.teleportOwl(i);
  }
  openInventory() {
    const t = Math.floor(this.playTime);
    this.ui.inventory2(this.inv, { shells: this.inv.count('shell'), time: `${Math.floor(t / 60)}분 ${t % 60}초`, hp: this.player.hp, max: this.player.maxHp },
      (id, act) => { if (act === 'equip') this.inv.equip(id); else this.useItem(id); });
  }
  private useItem(id: string) {
    if ((ITEMS[id]?.kind as string) === 'food') { this.cooking.eat(id); this.particles.sparkle(this.player.pos.clone().setY(this.player.pos.y + 1.2), 0xff9ab0); return; }
    if (id === 'berry') {
      if (this.player.hp >= this.player.maxHp) { this.ui.toast('체력이 이미 가득해요'); return; }
      this.inv.take('berry'); this.player.heal(6); this.audio.play('heal'); this.particles.sparkle(this.player.pos.clone().setY(this.player.pos.y + 1.2), 0xff9ab0);
      this.ui.toast('회복 열매를 먹었어요 (하트 3칸 회복)');
    }
  }

  // ------------------------------------------------------------------ flow
  toTitle() {
    this.mode = 'title';
    this.ui.show('hud', false); this.ui.prompt(null, false); this.ui.boss(null);
    this.touch.setVisible(false);
    this.ui.title(true, !!Save.read());
    this.audio.setTheme('title');
    this.setArea('island', true);
    this.player.place(L.START.x, L.START.z, L.START.yaw);
  }
  private beginPlay() {
    this.ui.title(false, false); this.ui.closePanel();
    this.ui.show('hud', true); this.touch.setVisible(true);
    this.mode = 'play';
    this.rig.targetYaw = this.player.yaw + Math.PI; this.rig.targetPitch = this.area === 'dungeon' ? 1.02 : 0.84; this.rig.targetDist = this.area === 'dungeon' ? 25 : 23;
    this.rig.snap(this.player.pos);
    this.ui.hearts(this.player.hp, this.player.maxHp); this.ui.shells(this.inv.count('shell'));
    this.ui.equip(this.inv, this.touch.enabled);
    events.emit('quest');
    this.region = '';
    this.fpsAcc = []; this.autoChecked = false;
  }
  openCreator() {
    this.ui.title(false, false); this.ui.closePanel();
    this.mode = 'create';
    this.setArea('island', true);
    this.player.place(L.START.x, L.START.z, 0.3);
    this.createYaw = 0.3;
    this.player.setLook(lookFrom(this.appearance));
    const groups = [
      { key: 'gender', label: '성별', type: 'choice' as const, options: [{ value: 'f', label: '여자' }, { value: 'm', label: '남자' }] },
      { key: 'style', label: '헤어', type: 'choice' as const, options: [{ value: 'hero', label: '묶은 머리' }, { value: 'bob', label: '단발' }, { value: 'short', label: '짧은 머리' }, { value: 'braids', label: '양갈래' }] },
      { key: 'hair', label: '머리색', type: 'swatch' as const, options: Object.entries(HAIR).map(([k, v]) => ({ value: k, color: '#' + v[1].toString(16).padStart(6, '0'), label: v[2] })) },
      { key: 'skin', label: '피부색', type: 'swatch' as const, options: Object.entries(SKIN).map(([k, v]) => ({ value: k, color: '#' + v.toString(16).padStart(6, '0') })) },
      { key: 'eye', label: '눈 색', type: 'swatch' as const, options: Object.entries(EYE).map(([k, v]) => ({ value: k, color: '#' + v.toString(16).padStart(6, '0') })) },
      { key: 'eyeSize', label: '눈 크기', type: 'range' as const, min: 0.8, max: 1.35, step: 0.05 },
      { key: 'outfit', label: '옷', type: 'swatch' as const, options: Object.entries(OUTFIT).map(([k, v]) => ({ value: k, color: '#' + v.tunic.toString(16).padStart(6, '0'), label: v.label })) },
    ];
    const show = () => this.ui.creator({ name: this.playerName, groups, values: this.appearance as unknown as Record<string, string> },
      (k, v) => {
        if (k === 'name') { this.playerName = v || '미루'; return; }
        (this.appearance as any)[k] = v;
        if (k === 'gender') { this.appearance.style = v === 'm' ? 'short' : 'hero'; show(); }
        this.player.setLook(lookFrom(this.appearance));
      },
      () => {
        const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
        const g = pick(['f', 'm']) as 'f' | 'm';
        this.appearance = { gender: g, style: pick(g === 'm' ? ['short', 'short', 'bob', 'hero'] : ['hero', 'bob', 'braids', 'short']), hair: pick(Object.keys(HAIR)), skin: pick(Object.keys(SKIN)), eye: pick(Object.keys(EYE)), eyeSize: (0.85 + Math.random() * 0.45).toFixed(2), outfit: pick(Object.keys(OUTFIT)) };
        this.player.setLook(lookFrom(this.appearance)); show();
      },
      (name) => { this.playerName = name; this.newGame(); },
      (d) => { this.createYaw += d; });
    show();
  }
  newGame() {
    this.ui.hideCreator();
    this.quest.name = this.playerName; this.quest.gender = this.appearance.gender;
    this.inv.load({}); this.quest.load([]); this.playTime = 0;
    this.loadV2(null);
    for (const c of this.chests.values()) this.resetChest(c, false);
    this.world.veg.restoreBushes(null);
    for (const p of this.world.pots) { p.alive = true; p.obj.visible = true; p.collider.active = true; }
    this.resetDungeon(); this.clearEnemies(); this.spawnIsland();
    this.ruinsBlock.setPos(L.RUINS_PUZZLE.block.x, L.RUINS_PUZZLE.block.z); this.ruinsGate.setOpen(false, true);
    this.clearAltar();
    this.player.hp = this.player.maxHp;
    this.setArea('island', true);
    this.player.place(L.START.x, L.START.z, L.START.yaw);
    this.beginPlay();
    this.player.setLook(lookFrom(this.appearance));
    this.say([{ who: this.playerName, text: '음… 바람 소리가 하나도 안 들려. 소라 할머니한테 가 봐야겠다.' }]);
  }
  continueGame() {
    const d = Save.read(); if (!d) { this.openCreator(); return; }
    this.appearance = { ...DEFAULT_APPEARANCE, ...(d.appearance ?? {}) }; this.playerName = d.name ?? '미루'; this.quest.name = this.playerName; this.quest.gender = this.appearance.gender;
    this.inv.load(d.inventory); this.player.setLook(lookFrom(this.appearance));
    this.inv.load(d.inventory); this.quest.load(d.flags); this.playTime = d.playTime ?? 0;
    this.loadV2(d);
    for (const c of this.chests.values()) this.resetChest(c, d.chests.includes(c.def.id));
    this.world.veg.restoreBushes(d.bushes ?? []);
    for (const p of this.world.pots) { const broken = d.pots?.includes(p.id); p.alive = !broken; p.obj.visible = !broken; p.collider.active = !broken; }
    this.resetDungeon();
    const D = d.dungeon;
    if (D) {
      D.torches.forEach((lit, i) => { if (lit) this.dungeon.torchesA.light(i); });
      this.dungeon.blockB.setPos(D.block[0], D.block[1]);
      if (D.doorC) this.dungeon.doorC.setOpen(true, true);
      if (this.dungeon.torchesA.allLit()) this.dungeon.gateA.setOpen(true, true);
      if (D.keyChest) this.revealKeyChest(true);
    }
    if (this.quest.has('ruinsOpen')) { this.ruinsBlock.setPos(L.RUINS_PUZZLE.plate.x, L.RUINS_PUZZLE.plate.z); this.ruinsGate.setOpen(true, true); }
    this.clearAltar(); if (this.quest.has('ending')) this.placeAltarPearl(true);
    this.clearEnemies();
    this.player.hp = Math.max(2, Math.min(d.hp, this.inv.maxHearts * 2));
    this.setArea(d.area, true);
    this.player.place(d.pos[0], d.pos[2], d.yaw);
    if (d.area === 'dungeon') this.spawnDungeon(); else this.spawnIsland();
    this.beginPlay();
    this.ui.toast('이어서 모험을 시작해요');
  }
  /** v2 fields (missing in v1 saves -> sensible defaults; main-quest progress migrated from v1 flags) */
  private loadV2(d: SaveData | null) {
    const v2 = (d as any)?.v2 ?? {};
    // v1 'ending' meant "pearl placed" in the old story: migrate to the new chapter flag
    if (d && !v2.quests && this.quest.has('ending')) { this.quest.flags.delete('ending'); this.quest.set('pearlPlaced'); }
    this.codex.load(v2.codex); this.explore.load(v2.explore); this.fishing.load(v2.fishing); this.cooking.load(v2.cooking); this.minigames.load(v2.minigames);
    this.time_.load(v2.time); this.relations = v2.relations ?? {}; this.mount.load(v2.mount);
    this.discovered.fill(0); if (typeof v2.discovered === 'string') for (let i = 0; i < Math.min(4096, v2.discovered.length); i++) this.discovered[i] = v2.discovered[i] === '1' ? 1 : 0;
    this.qm.load(v2.quests, (f) => this.quest.has(f), (i) => this.inv.has(i) || (i === 'lantern' && this.quest.has('enteredCave')));
    for (const id of this.inv.list()) this.codex.seeItem(id);
  }
  save() {
    if (this.mode === 'title') return;
    const p = this.player.pos;
    const D = this.dungeon;
    const d: SaveData = {
      v: 2, time: Date.now(), pos: [p.x, p.y, p.z], yaw: this.player.yaw, area: this.area, hp: this.player.hp,
      inventory: this.inv.toJSON(), flags: this.quest.toJSON(), appearance: this.appearance, name: this.playerName, chests: [...this.chests.values()].filter((c) => c.opened).map((c) => c.def.id),
      bushes: this.world.veg.bushes.filter((b) => !b.alive).map((b) => b.index), pots: this.world.pots.filter((x) => !x.alive).map((x) => x.id),
      dungeon: { torches: D.torchesA.torches.map((t) => t.lit), block: [D.blockB.col.x, D.blockB.col.z], doorC: D.doorC.open, bossDead: this.quest.has('bossDead'), keyChest: this.quest.has('keyChest') },
      playTime: this.playTime,
      v2: { quests: this.qm.toJSON(), codex: this.codex.toJSON(), explore: this.explore.toJSON(), fishing: this.fishing.toJSON(), cooking: this.cooking.toJSON(), minigames: this.minigames.toJSON(),
        time: this.time_.toJSON(), mount: this.mount.toJSON(), relations: this.relations, discovered: Array.from(this.discovered).join('') },
    } as unknown as SaveData;
    Save.write(d);
  }
  private resetChest(c: ChestEnt, opened: boolean) {
    c.opened = opened; c.openT = opened ? 1 : 0; c.obj.lid.rotation.x = opened ? -1.9 : 0;
    if (c.def.hidden) { c.visible = opened; c.obj.visible = opened; c.collider.active = opened; }
  }
  private resetDungeon() {
    const D = this.dungeon;
    D.torchesA.torches.forEach((t, i) => { t.lit = false; t.flame.visible = false; D.torchesA.lights[i].intensity = 0; });
    D.gateA.setOpen(false, true); D.gateB.setOpen(false, true); D.doorC.setOpen(false, true);
    D.blockB.setPos(DX - 4, -18);
  }
  private respawn() {
    this.player.hp = this.player.maxHp; this.player.inv = 1.5;
    this.clearEnemies();
    if (this.area === 'dungeon') this.player.place(DUNGEON_ENTRY.x, DUNGEON_ENTRY.z, DUNGEON_ENTRY.yaw);
    else if (this.area === 'grove') this.player.place(GROVE.x, GROVE.z + 11, Math.PI);
    else if (this.area === 'sky') this.player.place(SKY.x, SKY.z + 11, Math.PI);
    else this.player.place(L.START.x, L.START.z, L.START.yaw);
    this.spawnArea(this.area);
    this.rig.snap(this.player.pos);
    this.mode = 'play'; this.ui.hearts(this.player.hp, this.player.maxHp);
  }

  // ------------------------------------------------------------------ areas & spawning
  private clearEnemies() { for (const e of this.enemies) e.dispose(); this.enemies = []; for (const s of this.shots) s.mesh.removeFromParent(); this.shots = []; this.respawnTimers = []; this.boss = null; this.ui.boss(null); }
  private env() { return { groundAt: (x: number, z: number, m?: number) => this.groundAt(x, z, m), col: this.world.col, playerPos: this.player.pos, playerAlive: () => this.player.action !== 'dead' && this.mode === 'play' }; }
  private spawn(type: EnemyType, x: number, z: number) { const e = new Enemy(type, x, z, this.scene, this.env(), this.shots); e.onDeath = (en) => this.onEnemyDeath(en); this.enemies.push(e); return e; }
  private spawnIsland() { for (const s of L.ENEMY_SPAWNS) this.spawn(s.type as EnemyType, s.x, s.z); }
  spawnEnemy(type: EnemyType, x: number, z: number) { return this.spawn(type, x, z); }
  private spawnArea(a: string) {
    this.arenaBoss = null; this.finalBoss = null; this.nightMoths = [];
    if (a === 'dungeon') this.spawnDungeon();
    else if (a === 'island') this.spawnIsland();
    else if (a === 'grove') { this.codex.see('places', 'grove'); if (!this.quest.has('guardianDead')) { const e = this.spawn('guardian', GROVE.x, GROVE.z - 6); e.yaw = 0; this.arenaBoss = e; } }
    else if (a === 'sky') { this.codex.see('places', 'skyIsle'); if (!this.quest.has('finalBossDead')) { const e = this.spawn('storm', SKY.x, SKY.z - 5); this.finalBoss = e; this.arenaBoss = e; } }
  }
  dropPickup(id: string, pos: THREE.Vector3, n = 1) { this.dropItem(id, pos, n); }
  itemName(id: string) { return ITEMS[id]?.name ?? id; }
  useLantern() { this.useTool_lantern(); }
  onNewDay() { this.explore.newDay(this.time_.day); this.ui.toast(`${this.time_.day}일째 아침이 밝았어요`); }
  onPeriodChange(p: string) {
    if (this.area !== 'island') return;
    if (p === 'night') { for (let i = 0; i < 4; i++) { const a = i * 1.6; const e = this.spawn('moth', 20 * Math.cos(a) - 10, 30 * Math.sin(a) + 10); this.nightMoths.push(e); } this.ui.toast('밤이 되었어요. 등불나방이 날아다녀요'); }
    if (p === 'morning') { for (const e of this.nightMoths) if (!e.dead) { e.dispose(); this.enemies = this.enemies.filter((x) => x !== e); } this.nightMoths = []; }
  }
  private markerSprite() {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false })); sp.scale.set(0.55, 0.55, 1); sp.renderOrder = 12; sp.visible = false;
    (sp as any).draw = (ch: string) => { const x = c.getContext('2d')!; x.clearRect(0, 0, 64, 64); if (!ch) { sp.visible = false; return; } sp.visible = true; x.fillStyle = ch === '!' ? '#f2c14c' : '#6ad86a'; x.strokeStyle = '#4a3424'; x.lineWidth = 6; x.beginPath(); x.arc(32, 32, 27, 0, Math.PI * 2); x.fill(); x.stroke(); x.fillStyle = '#4a3424'; x.font = 'bold 40px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ch, 32, 35); t.needsUpdate = true; };
    return sp;
  }
  openMap() {
    const owlNames = ['사원 길 서쪽', '사원 길 동쪽', '폐허 입구', '호수 남쪽 언덕', '동굴 갈림길'];
    this.ui.map({
      draw: (cv) => this.drawBigMap(cv),
      owls: L.STATUES.map((_, i) => ({ i, name: owlNames[i] ?? `석상 ${i + 1}`, active: this.explore.owls.has(i) })),
      legend: '● 나 · ★ 메인 목표 · ◆ 상자 · ✕ 판 보물 · 🦉 석상(누르면 이동) · 🎣 낚시터 · 🍲 요리 냄비 · ⚑ 미니게임 · 흐린 곳은 아직 가 보지 않은 지역',
    });
  }
  private teleportOwl(i: number) {
    if (this.area !== 'island') { this.ui.toast('섬 위에서만 빠르게 이동할 수 있어요'); return; }
    const s = L.STATUES[i]; this.ui.closePanel();
    this.transitionTo('island', s[0] + 2, s[1] + 2, Math.PI);
  }
  private drawBigMap(cv: HTMLCanvasElement) {
    const x = cv.getContext('2d')!, S = cv.width, k = S / (WORLD_HALF * 2);
    const W2 = (wx: number) => (wx + WORLD_HALF) * k;
    x.fillStyle = '#3d8fb0'; x.fillRect(0, 0, S, S);
    x.drawImage((this.minimap as any).base, 0, 0, S, S);
    // fog of war over unexplored cells
    x.fillStyle = 'rgba(240,232,214,0.82)';
    const cs = S / 64;
    for (let j = 0; j < 64; j++) for (let i = 0; i < 64; i++) if (!this.discovered[j * 64 + i]) x.fillRect(i * cs - 0.5, j * cs - 0.5, cs + 1, cs + 1);
    const seen = (wx: number, wz: number) => this.discovered[Math.floor((wz + WORLD_HALF) / (WORLD_HALF * 2) * 64) * 64 + Math.floor((wx + WORLD_HALF) / (WORLD_HALF * 2) * 64)];
    const mark = (wx: number, wz: number, t: string, col = '#4a3424', size = 16) => { if (!seen(wx, wz)) return; x.font = `${size}px sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = col; x.fillText(t, W2(wx), W2(wz)); };
    for (const c of this.chests.values()) if (!c.def.dungeon) mark(c.def.x, c.def.z, c.opened ? '◇' : '◆', '#c8901c');
    for (const d of (PlacesMod.DIG_SPOTS)) if (this.explore.dug.has(d.id)) mark(d.x, d.z, '✕', '#c0392b');
    L.STATUES.forEach((s, i) => mark(s[0], s[1], '🦉', this.explore.owls.has(i) ? '#2f9e94' : '#888'));
    for (const p of PlacesMod.POTS_COOK) mark(p.x, p.z, '🍲');
    for (const p of [[2, 80], [44, -8], [-88, 0]]) mark(p[0], p[1], '🎣');
    for (const p of [PlacesMod.ARCHERY.sign, PlacesMod.RACE.sign, PlacesMod.ARENA.sign]) mark(p.x, p.z, '⚑', '#2f6a9e');
    mark(L.CAVE.x, L.CAVE.z, '⛰', '#4a3424', 18); mark(L.TEMPLE_POS.x, L.TEMPLE_POS.z, '⛩', '#4a3424', 18);
    for (const n of this.npcs) if (!n.hidden) mark(n.pos.x, n.pos.z, '●', '#ffffff', 12);
    const g = this.goal('island'); if (g) { x.font = 'bold 22px sans-serif'; x.fillStyle = '#f07a50'; x.fillText('★', W2(g.x), W2(g.z)); }
    if (this.area === 'island') { const P = this.player.pos; x.fillStyle = '#f07a50'; x.strokeStyle = '#fff'; x.lineWidth = 3; x.beginPath(); x.arc(W2(P.x), W2(P.z), 7, 0, Math.PI * 2); x.fill(); x.stroke(); }
  }
  private spawnDungeon() {
    if (!this.quest.has('roomB')) { this.spawn('moth', DX - 3, -22); this.spawn('moth', DX + 3, -17); }
    if (!this.quest.has('keyChest')) { this.spawn('moth', DX - 4, -38); this.spawn('moth', DX + 4, -42); this.spawn('moth', DX, -36); this.spawn('crab', DX - 5, -43); this.spawn('crab', DX + 5, -37); }
    if (!this.quest.has('bossDead')) { this.boss = this.spawn('boss', DX, -70); this.boss.yaw = 0; }
  }
  setArea(a: 'island' | 'dungeon' | 'grove' | 'sky', instant = false) {
    this.area = a;
    const w = this.world, s = this.scene;
    if (a === 'dungeon') {
      s.background = new THREE.Color(0x05080c); s.fog = new THREE.Fog(0x0a1620, 22, 60);
      w.hemi.color.set(0x7fa8c8); w.hemi.groundColor.set(0x1a2a30); w.hemi.intensity = 0.55; (s as any).environmentIntensity = 0.08; w.sun.intensity = 0.35; w.sun.color.set(0x9fc8ff);
      w.water.visible = false;
      this.rs.grade.uniforms.uVig.value = 0.5;
    } else if (a === 'grove') {
      s.background = new THREE.Color(0x2a4a2a); s.fog = new THREE.Fog(0x3a5a38, 25, 70);
      w.hemi.color.set(0xd8f0c0); w.hemi.groundColor.set(0x2a4a20); w.hemi.intensity = 0.9; (s as any).environmentIntensity = 0.12; w.sun.intensity = 1.8; w.sun.color.set(0xf0ffd0);
      w.water.visible = false; this.rs.grade.uniforms.uVig.value = 0.45;
    } else if (a === 'sky') {
      s.background = new THREE.Color(0x3a3a6a); s.fog = new THREE.Fog(0x4a4a7a, 40, 140);
      w.hemi.color.set(0xc8c0ff); w.hemi.groundColor.set(0x5a5a8a); w.hemi.intensity = 1.0; (s as any).environmentIntensity = 0.2; w.sun.intensity = 2.0; w.sun.color.set(0xe8e0ff);
      w.water.visible = false; this.rs.grade.uniforms.uVig.value = 0.4;
    } else {
      s.background = new THREE.Color(0xd6f0ff); s.fog = new THREE.Fog(0xd6f0ff, 95, 260);
      w.hemi.color.set(0xcfe9ff); w.hemi.groundColor.set(0x7a9a4a); w.hemi.intensity = 1.05; (s as any).environmentIntensity = 0.2; w.sun.intensity = 2.7; w.sun.color.set(0xfff0d6);
      w.water.visible = true;
      this.rs.grade.uniforms.uVig.value = 0.32;
    }
    this.dungeon.group.visible = a === 'dungeon'; this.arenas.grove.visible = a === 'grove'; this.arenas.sky.visible = a === 'sky';
    this.rig.targetPitch = a === 'dungeon' ? 1.02 : 0.84; this.rig.targetDist = a === 'dungeon' ? 25 : a === 'island' ? 23 : 26;
    void instant;
  }
  transitionTo(a: 'island' | 'dungeon' | 'grove' | 'sky', x: number, z: number, yaw: number) {
    this.mode = 'transition'; this.ui.fade(true); this.audio.play('door');
    setTimeout(() => {
      this.clearEnemies();
      this.setArea(a);
      this.player.place(x, z, yaw);
      this.spawnArea(a);
      this.rig.targetYaw = yaw + Math.PI; this.rig.snap(this.player.pos);
      this.region = '';
      this.save();
      setTimeout(() => { this.ui.fade(false); this.mode = 'play'; }, 150);
    }, 480);
  }

  // ------------------------------------------------------------------ helpers
  say(lines: { who: string; text: string; choices?: any[] }[], done?: (v?: string) => void) { this.ui.dialog(lines, done); }
  shake(a: number) { if (this.settings.shake) this.rig.shake(a); }
  private dropItem(id: string, pos: THREE.Vector3, count = 1, big = false) {
    const obj = itemModel(id); obj.scale.setScalar(big ? 1.4 : 0.6);
    this.scene.add(obj);
    const vel = big ? new THREE.Vector3(0, 0, 0) : new THREE.Vector3((Math.random() - 0.5) * 3, 5, (Math.random() - 0.5) * 3);
    this.pickups.push({ obj, id, pos: pos.clone(), vel, t: 0, big, count });
  }
  private onEnemyDeath(e: Enemy) {
    const p = e.pos.clone().setY(e.pos.y + 0.8);
    this.particles.poof(p); this.shake(0.15);
    if (e.type === 'boss') {
      this.quest.set('bossDead'); this.ui.boss(null); this.boss = null;
      this.audio.setTheme('dungeon');
      for (let i = 0; i < 6; i++) setTimeout(() => this.particles.poof(e.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, 1 + Math.random() * 3, (Math.random() - 0.5) * 4)), 0xffe0f0), i * 140);
      setTimeout(() => { this.dropItem('moonPearl', e.pos.clone().setY(e.pos.y + 1.2), 1, true); this.dropItem('heartContainer', e.pos.clone().add(new THREE.Vector3(3, 1.2, 0)), 1, true); }, 900);
      this.shake(0.8);
      return;
    }
    this.codex.see('monsters', e.type);
    events.emit('enemyKilled', e.type);
    this.minigames.onKill(e.type);
    if (e.type === 'guardian' || e.type === 'kingCrab' || e.type === 'storm') { this.bossDefeated(e); return; }
    if (e.type === 'crab' && Math.random() < 0.4) this.dropItem('crabMeat', p);
    if (e.type === 'acorn' && Math.random() < 0.15) this.dropItem('arrow', p, 3);
    const r = Math.random();
    if (r < 0.3 && this.player.hp < this.player.maxHp) this.dropItem('heart', p);
    else if (r < 0.75) this.dropItem('shell', p, Math.random() < 0.25 ? 5 : 1);
    else if (r < 0.83) this.dropItem('berry', p);
  }
  private bossDefeated(e: Enemy) {
    this.ui.boss(null); this.arenaBoss = null; this.shake(0.9);
    for (let i = 0; i < 6; i++) setTimeout(() => this.particles.poof(e.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 5, 1 + Math.random() * 3, (Math.random() - 0.5) * 5)), 0xf0ffe0), i * 140);
    const at = e.pos.clone().setY(e.pos.y + 1.2);
    if (e.type === 'guardian') {
      this.quest.set('guardianDead'); this.audio.setTheme('forest');
      setTimeout(() => { this.dropItem('windForest', at, 1, true); this.dropItem('bow', at.clone().add(new THREE.Vector3(3, 0, 0)), 1, true); this.inv.add('arrow', 15); }, 900);
      this.say([{ who: '', text: '수호자가 쓰러지며 초록빛 바람돌과 오래된 활을 남겼다.' }]);
    } else if (e.type === 'kingCrab') {
      this.quest.set('kingCrabDead'); this.audio.setTheme('beach');
      setTimeout(() => { this.dropItem('windSea', at, 1, true); this.dropItem('heartContainer', at.clone().add(new THREE.Vector3(3, 0, 0)), 1, true); }, 900);
    } else if (e.type === 'storm') {
      this.quest.set('finalBossDead'); this.finalBoss = null; this.audio.setTheme('temple');
      setTimeout(() => this.finale(), 2200);
    }
  }
  private finale() {
    this.quest.set('ending'); this.mode = 'ending';
    this.say([{ who: '', text: '폭풍해파리가 빛 조각이 되어 흩어지자, 삼켜졌던 바람이 한꺼번에 섬으로 쏟아져 내려간다.' }, { who: '소라 할머니', text: `(멀리서) 바람이 돌아왔어! ${this.playerName}, 해냈구나!` }], () => {
      this.save(); const t = Math.floor(this.playTime);
      this.ui.credits({ time: `${Math.floor(t / 60)}분 ${t % 60}초`, stars: this.inv.count('starShard') });
    });
  }
  private checkRoomClear() {
    const inC = this.enemies.filter((e) => Math.abs(e.home.z + 40) < 8 && !e.dead).length;
    if (!this.quest.has('keyChest') && inC === 0 && this.area === 'dungeon' && this.dungeon.roomAt(this.player.pos.x, this.player.pos.z) === 2) {
      this.quest.set('keyChest'); this.revealKeyChest(false); this.audio.play('solve');
    }
    const inB = this.enemies.filter((e) => Math.abs(e.home.z + 20) < 8 && !e.dead).length;
    if (inB === 0) this.quest.set('roomB');
  }
  private revealKeyChest(instant: boolean) {
    const c = this.chests.get('d_key')!;
    if (c.opened) return;
    c.visible = true; c.obj.visible = true; c.collider.active = true;
    if (!instant) { this.particles.poof(c.obj.position.clone().setY(0.6), 0xd8f6ff); this.particles.sparkle(c.obj.position.clone().setY(1)); this.ui.toast('보물상자가 나타났어요!'); }
  }
  private slam(p: THREE.Vector3) {
    this.particles.dust(p, 18);
    for (const e of this.enemies) if (!e.dead && Math.hypot(e.pos.x - p.x, e.pos.z - p.z) < 2.6 + e.radius && e.lastSwing !== this.player.swingId) {
      e.lastSwing = this.player.swingId; e.damage(2 * this.inv.weaponDmg(), p, 9); this.onHitFx(e.pos.clone().setY(e.pos.y + 0.8));
    }
  }
  private onHitFx(at: THREE.Vector3) { this.particles.hit(at); this.audio.play('hit'); this.hitstop = 0.065; this.shake(0.22); }

  // ------------------------------------------------------------------ interaction
  private findInteract(): { label: string; act: () => void } | null {
    const p = this.player.pos, f = this.player.facing();
    const near = (x: number, z: number, r: number) => Math.hypot(x - p.x, z - p.z) < r;
    const facing = (x: number, z: number) => { const dx = x - p.x, dz = z - p.z, l = Math.hypot(dx, dz) || 1; return (dx * f.x + dz * f.z) / l > 0.2; };
    if (this.fishing.st !== 'idle') return null;
    for (const n of this.npcs) if (this.area === 'island' && !n.hidden && near(n.pos.x, n.pos.z, 2.4)) return { label: `${n.name}와 대화하기`, act: () => this.talk(n) };
    if (this.area === 'island') { const x = this.explore.interact(p) ?? this.minigames.interact(p) ?? this.mount.interact(p); if (x) return x; }
    if (this.area === 'grove' && near(GROVE.x, GROVE.z + 13.5, 2.8)) return { label: '숲 밖으로 나가기', act: () => this.transitionTo('island', -58, -16.5, Math.PI) };
    if (this.area === 'sky' && near(SKY.x, SKY.z + 13, 2.8) && (this.quest.has('finalBossDead') || !this.finalBoss)) return { label: '사원으로 내려가기', act: () => this.transitionTo('island', 0, -76, Math.PI) };
    for (const c of this.chests.values()) if (!c.opened && c.visible && near(c.def.x, c.def.z, 2.2) && facing(c.def.x, c.def.z)) return { label: '상자 열기', act: () => this.openChest(c) };
    if (this.area === 'island') {
      for (const s of this.world.signs) if (near(s.x, s.z, 2) && facing(s.x, s.z)) return { label: '읽기', act: () => this.say([{ who: '표지판', text: s.text.replace(/\n/g, ' ') }]) };
      const rb = this.ruinsBlock, o = L.RUINS_PUZZLE.block;
      if (!this.quest.has('ruinsOpen') && !rb.moving && near(rb.col.x, rb.col.z, 2.4) && (rb.col.x !== o.x || rb.col.z !== o.z)) return { label: '돌을 제자리로 되돌리기', act: () => this.resetBlock(rb, o.x, o.z) };
      if (near(L.CAVE.x, L.CAVE.z, 4.8)) return { label: '물빛 동굴로 들어가기', act: () => this.enterCave() };
      if (near(L.TEMPLE_POS.x, L.TEMPLE_POS.z, 2.8)) return { label: this.inv.has('moonPearl') ? '달진주 바치기' : (this.inv.has('windForest') && this.inv.has('windSea')) ? '바람돌 바치기' : this.quest.has('stonesPlaced') && !this.quest.has('finalBossDead') ? '하늘 길로 올라가기' : '제단 살펴보기', act: () => this.altar() };
    } else {
      if (near(DX, 8.5, 2.6)) return { label: '밖으로 나가기', act: () => this.transitionTo('island', L.CAVE.x + Math.sin(L.CAVE.yaw) * 4, L.CAVE.z + Math.cos(L.CAVE.yaw) * 4, L.CAVE.yaw) };
      const D = this.dungeon;
      if (!D.doorC.open && near(DX, -46, 2.8)) return { label: this.inv.has('smallKey') ? '작은 열쇠로 열기' : '잠긴 문 살펴보기', act: () => this.unlockDoor() };
      const bb = D.blockB;
      if (!D.gateB.open && !bb.moving && near(bb.col.x, bb.col.z, 2.4) && (bb.col.x !== DX - 4 || bb.col.z !== -18)) return { label: '돌을 제자리로 되돌리기', act: () => this.resetBlock(bb, DX - 4, -18) };
      const ti = D.torchesA.nearest(p, 2.2);
      if (ti >= 0 && !D.torchesA.torches[ti].lit) return { label: this.inv.has('lantern') ? '등불로 불 붙이기' : '꺼진 횃불', act: () => this.lightTorch(ti) };
    }
    return null;
  }
  talkTo(id: string, name: string) {
    const q = this.qm.npcQuest(id);
    if (q) { this.say(q.lines.map((t) => ({ who: name, text: t })), () => q.action()); return; }
    this.say([{ who: name, text: id === 'wolf' ? '(늑대가 낑낑거린다.)' : '…' }]);
  }
  private talk(n: NPC) {
    n.talking = true;
    if (n.id === 'elder') this.quest.set('metElder');
    const greet = this.time_.isNight ? '밤이 깊었구나. ' : this.time_.period === 'morning' ? '좋은 아침! ' : '';
    if (!this.quest.has('met_' + n.id) && n.id !== 'elder') { this.quest.set('met_' + n.id); }
    // main story hand-offs
    if (n.id === 'fisher' && this.qm.state.m7 === 'active' && !this.inv.has('map2') && !this.explore.dug.has('d_map2')) {
      this.say([{ who: n.name, text: '바다 쪽 바람돌? 옛날에 할아버지가 그린 지도가 있지. "갈매기 바위가 내려다보는 모래밭"이라더군.' }, { who: n.name, text: '삽으로 파 보면 뭔가 나올 거야. 조심해, 뭔가 큰 게 사는 것 같거든.' }], () => { n.talking = false; this.inv.add('map2'); if (!this.inv.has('shovel')) this.inv.add('shovel'); this.ui.toast('낡은 보물지도 ②를 받았다'); });
      return;
    }
    const q = this.qm.npcQuest(n.id);
    if (q) { this.say(q.lines.map((t) => ({ who: n.name, text: t })), () => { n.talking = false; q.action(); }); return; }
    if (n.id === 'fisher' && this.quest.has('contestOpen') && !this.fishing.contest) {
      this.say([{ who: n.name, text: `${greet}낚시 대회 한 판 할까? 2분 동안 잡은 물고기 점수로 순위를 매긴다! (최고 ${this.fishing.bestContest}점)`, choices: [{ label: '참가할래요', value: 'contest' }, { label: '다음에', value: 'no' }] }], (v) => { n.talking = false; if (v === 'contest') { if (!this.inv.has('rod')) this.inv.add('rod'); this.inv.wear('rod'); this.fishing.startContest(); } });
      return;
    }
    const rel = this.relations[n.id] ?? 0;
    const relLines: Record<string, string> = { elder: '옛날 이야기 하나 해 줄까? 돌기둥 셋이 선 언덕은 달밤에만 흙이 빛난다더라.', baker: '요즘 버섯이랑 생선을 같이 구우면 든든하다는 소문이 돌아!', kid: '밤이 되면 바닷가 모래 어딘가가 반짝인대!', smith: '거인의 장갑이라… 산 위 바위를 들어 올릴 수 있다면 전설의 상자에 닿을 텐데.', fisher: '밤바다 절벽 아래에선 전설의 물고기를 봤다는 사람이 있어.' };
    const lines = this.quest.npcLines(n.id).map((l, i) => i === 0 && greet ? { ...l, text: greet + l.text } : l);
    if (rel >= 1 && relLines[n.id]) lines.push({ who: n.name, text: relLines[n.id] });
    this.say(this.quest.npcLines(n.id), (v) => {
      n.talking = false;
      if (v === 'shop') { this.openShop(); return; }
      if (v === 'contest') return;
      if (v === 'buyBerry') {
        if (this.inv.take('shell', 10)) { this.inv.add('berry'); this.ui.shells(this.inv.count('shell')); this.audio.play('smallGet'); this.say([{ who: '다래', text: '고마워! 맛있게 먹어. 체력이 떨어지면 가방에서 꺼내 먹으면 돼.' }]); }
        else this.say([{ who: '다래', text: '어라, 조개가 모자라네. 풀숲이나 항아리를 살펴보면 조개가 나올 거야!' }]);
      }
      if (n.id === 'elder') events.emit('quest');
    });
  }
  openShop() {
    const SELL_KINDS = ['fish', 'material', 'treasure', 'food'];
    const up = (k: 'sword' | 'shield') => { const lv = this.inv.upgrades[k] ?? 0; return { lv, shells: [60, 120, 200][lv], ore: [1, 2, 3][lv] }; };
    const render = (tab = 'buy') => {
      const buy = [...L.SHOP, { id: 'bomb', price: 6, currency: 'shell' as const }, { id: 'arrow', price: 2, currency: 'shell' as const }].map((it) => { const d = ITEMS[it.id]; const owned = !d.stack && d.kind !== 'consumable' && this.inv.has(it.id); return { ...it, owned, equipped: owned && Object.values(this.inv.equipped).includes(it.id), afford: this.inv.count(it.currency) >= it.price }; });
      const sell = this.inv.list().filter((id) => SELL_KINDS.includes(ITEMS[id]?.kind as string) && (ITEMS[id]?.price ?? 0) > 0).map((id) => ({ id, n: this.inv.count(id), price: Math.max(1, Math.floor((ITEMS[id].price ?? 1) * 0.6)) }));
      const ups = (['sword', 'shield'] as const).map((k) => { const u = up(k); const free = this.quest.has('freeUpgrade'); return { key: k, label: k === 'sword' ? '검 공격력' : '방패 방어 각도', level: u.lv, max: u.lv >= 3, cost: free ? '무료(광석 의뢰 보상)' : `반짝 조개 ${u.shells} + 단단한 광석 ${u.ore}`, can: free || (this.inv.count('shell') >= u.shells && this.inv.count('ore') >= u.ore) }; });
      this.ui.shop2({ buy, sell, upgrades: ups, wallet: { shell: this.inv.count('shell'), berry: this.inv.count('berry') } },
        (id) => { const it = buy.find((b) => b.id === id)!; if (!this.inv.take(it.currency, it.price)) return; const n = id === 'arrow' ? 5 : id === 'bomb' ? 1 : 1; this.inv.add(id, n); if (ITEMS[id].kind !== 'consumable' && !ITEMS[id].stack) this.inv.wear(id); this.audio.play('itemGet'); this.ui.toast(`${ITEMS[id].name}${n > 1 ? ` ×${n}` : ''}을(를) 샀어요`); this.save(); render('buy'); },
        (id, all) => { const n = all ? this.inv.count(id) : 1; const pr = Math.max(1, Math.floor((ITEMS[id].price ?? 1) * 0.6)); if (!this.inv.take(id, n)) return; this.inv.add('shell', pr * n); this.audio.play('smallGet'); this.ui.toast(`${ITEMS[id].name} ×${n} → 조개 ${pr * n}`); render('sell'); },
        (k) => { const u = up(k as any); const free = this.quest.has('freeUpgrade'); if (u.lv >= 3) return; if (!free) { if (this.inv.count('shell') < u.shells || this.inv.count('ore') < u.ore) return; this.inv.take('shell', u.shells); this.inv.take('ore', u.ore); } else this.quest.flags.delete('freeUpgrade');
          this.inv.upgrades[k] = u.lv + 1; this.audio.play('solve'); this.ui.questBanner('장비 강화', `${k === 'sword' ? '검' : '방패'} +${u.lv + 1}`); this.save(); render('up'); }, tab);
    };
    render();
  }
  private openShopOld() {
    const render = () => {
      const items = L.SHOP.map((it) => {
        const d = ITEMS[it.id], owned = d.kind !== 'consumable' && this.inv.has(it.id);
        const e = this.inv.equipped as Record<string, string>;
        return { ...it, owned, equipped: owned && Object.values(e).includes(it.id), afford: this.inv.count(it.currency) >= it.price };
      });
      this.ui.shop(items, { shell: this.inv.count('shell'), berry: this.inv.count('berry') }, (id) => {
        const it = L.SHOP.find((x) => x.id === id)!;
        if (!this.inv.take(it.currency, it.price)) { this.ui.toast('값이 모자라요'); return; }
        this.inv.add(id);
        if (ITEMS[id].kind !== 'consumable') this.inv.wear(id);
        if (ITEMS[id].kind === 'armor') this.player.hp = Math.min(this.player.hp + (ITEMS[id].hearts ?? 0) * 2, this.player.maxHp);
        this.audio.play('itemGet');
        this.ui.toast(`${ITEMS[id].name}을(를) 샀어요${ITEMS[id].kind !== 'consumable' ? ' · 바로 장착했어요' : ''}`);
        this.ui.shells(this.inv.count('shell')); this.save();
        render();
      });
    };
    render();
  }
  private openChest(c: ChestEnt) {
    c.opened = true; this.audio.play('chest');
    this.player.yaw = Math.atan2(c.def.x - this.player.pos.x, c.def.z - this.player.pos.z);
    this.player.frozen = true;
    setTimeout(() => {
      this.player.frozen = false;
      this.giveItem(c.def.item, c.def.count ?? 1);
      this.particles.sparkle(c.obj.position.clone().setY(c.obj.position.y + 1.2), 0xfff2a0, 20);
      this.save();
    }, 650);
  }
  giveItem(id: string, count = 1) {
    this.pendingItem = { id, count };
    this.player.showItem(id);
    this.ui.itemGet(id, count);
    this.audio.play('itemGet');
    this.mode = 'itemget'; this.itemGetT = 0;
  }
  private finishItemGet() {
    const it = this.pendingItem!; this.pendingItem = null;
    this.inv.add(it.id, it.count);
    if (it.id === 'heartContainer') { this.player.hp = this.player.maxHp; }
    this.ui.hearts(this.player.hp, this.player.maxHp); this.ui.shells(this.inv.count('shell'));
    this.player.showItem(null); this.ui.hideItemGet(); this.mode = 'play';
    events.emit('quest');
    const extra: Record<string, string> = {
      sword: '공격 버튼으로 검을 휘둘러요. 연달아 누르면 세 번째에 회전 베기!',
      shield: '방어 버튼을 누르고 있으면 정면 공격을 막을 수 있어요.',
      lantern: '등불을 도구 칸에 장착했어요. 도구 버튼으로 앞의 횃불에 불을 붙일 수 있어요.',
      smallKey: '잠긴 문 앞에서 조사하면 열 수 있어요.',
      moonPearl: '이제 구름봉 꼭대기 달빛 사원으로 가요!',
    };
    if (extra[it.id]) this.ui.toast(extra[it.id]);
    if (it.id === 'moonPearl') this.audio.setTheme('dungeon');
  }
  private enterCave() {
    if (!this.inv.has('lantern')) { this.say([{ who: this.playerName, text: '안이 너무 깜깜해서 한 발짝도 못 들어가겠어. 등불이 있어야 해.' }]); return; }
    this.quest.set('enteredCave');
    this.transitionTo('dungeon', DUNGEON_ENTRY.x, DUNGEON_ENTRY.z, DUNGEON_ENTRY.yaw);
  }
  private unlockDoor() {
    if (!this.inv.has('smallKey')) { this.say([{ who: this.playerName, text: '단단히 잠겨 있어. 작은 열쇠가 필요해 보여.' }]); return; }
    this.inv.take('smallKey'); this.dungeon.doorC.setOpen(true); this.audio.play('solve'); this.ui.equip(this.inv, this.touch.enabled); this.save();
  }
  private lightTorch(i: number) {
    if (!this.inv.has('lantern')) { this.say([{ who: this.playerName, text: '불을 붙일 무언가가 필요해.' }]); return; }
    const T = this.dungeon.torchesA;
    if (T.light(i)) {
      this.particles.sparkle(T.torches[i].position.clone().setY(2), 0x9fe8ff, 18);
      if (T.allLit()) { setTimeout(() => { this.dungeon.gateA.setOpen(true); this.audio.play('solve'); this.ui.toast('철문이 열렸어요!'); }, 400); }
    }
  }
  private resetBlock(b: PushBlock, x: number, z: number) {
    this.particles.poof(b.obj.position.clone().setY(b.obj.position.y + 1), 0xe8e0d0);
    b.setPos(x, z);
    this.particles.poof(b.obj.position.clone().setY(b.obj.position.y + 1), 0xe8e0d0);
    this.audio.play('push');
    // keep the player out of the block's new footprint
    if (Math.abs(this.player.pos.x - x) < 1.5 && Math.abs(this.player.pos.z - z) < 1.5) this.player.place(x, z + 2.5, this.player.yaw);
  }
  private useTool() { this.tools.use(); }
  private useTool_lantern() {
    {
      this.player.action = 'interact'; this.player.actionT = 0;
      const p = this.player.pos.clone().add(this.player.facing().multiplyScalar(1.2)).setY(this.player.pos.y + 1.2);
      this.particles.sparkle(p, 0x9fe8ff, 10); this.audio.play('torch');
      if (this.area === 'dungeon') { const ti = this.dungeon.torchesA.nearest(this.player.pos, 2.8); if (ti >= 0) this.lightTorch(ti); }
    }
  }
  private altar() {
    if (this.quest.has('ending')) { this.say([{ who: '', text: '세 바람돌과 달진주가 제단 위에서 은은하게 빛나고 있다. 섬에 기분 좋은 바람이 분다.' }]); return; }
    if (this.quest.has('stonesPlaced')) { this.enterSky(); return; }
    if (this.inv.has('windForest') && this.inv.has('windSea')) {
      this.inv.take('windForest'); this.inv.take('windSea'); this.quest.set('stonesPlaced');
      this.audio.play('solve'); this.shake(0.5); this.particles.sparkle(this.player.pos.clone().setY(this.player.pos.y + 2), 0xbfe8ff, 40);
      this.say([{ who: '', text: '두 바람돌이 달진주 곁에 놓이자 세 빛이 하나로 모여 하늘로 솟구친다!' }, { who: '', text: '구름 위로 빛의 길이 열렸다. 폭풍의 주인이 기다린다.' }], () => this.enterSky());
      return;
    }
    if (this.quest.has('pearlPlaced')) { this.say([{ who: '', text: '제단의 문구: "세 바람이 모일 때 하늘 길이 열린다. 하나는 달, 하나는 숲, 하나는 바다에."' }, { who: '', text: `지금 가진 바람돌: ${['windForest', 'windSea'].filter((i) => this.inv.has(i)).length}/2` }]); return; }
    if (!this.inv.has('moonPearl')) { this.say([{ who: '', text: '둥근 홈이 파인 제단이다. 무언가를 올려 두었던 자리 같다.' }]); return; }
    this.inv.take('moonPearl'); this.quest.set('pearlPlaced');
    this.placeAltarPearl(false);
    this.audio.play('solve'); this.audio.setTheme('temple'); this.shake(0.4);
    this.inv.add('bomb', 5); this.inv.wear('bomb');
    this.say([{ who: '', text: '달진주를 올리자 제단 둘레에 글자가 떠오른다: "세 바람이 모일 때 하늘 길이 열린다. 하나는 달, 하나는 숲, 하나는 바다에."' },
      { who: '', text: '바람이 아주 잠깐 불었다가 다시 멎었다. 제단 아래 서랍에서 오래된 조개 폭탄 꾸러미를 발견했다!' },
      { who: this.playerName, text: '숲과 바다… 이끼숲 남쪽의 금 간 바위벽부터 가 보자.' }], () => { this.save(); });
  }
  enterSky() { this.transitionTo('sky', SKY.x, SKY.z + 11, Math.PI); }
  enterGrove() { this.transitionTo('grove', GROVE.x, GROVE.z + 11, Math.PI); }
  startKingCrab(at: THREE.Vector3) {
    this.say([{ who: '', text: '모래 속에서 거대한 껍데기가 솟아오른다!' }], () => {
      const e = this.spawn('kingCrab', at.x + 4, at.z - 3); e.home.set(at.x + 2, 0, at.z - 4); this.arenaBoss = e; this.audio.setTheme('boss'); this.shake(0.8);
      this.ui.toast('껍데기에 숨으면 폭탄으로 깨뜨리자!');
    });
  }
  private placeAltarPearl(instant: boolean) {
    const tp = L.TEMPLE_POS; const y = this.world.hf.height(tp.x, tp.z) + 2.75;
    this.altarPearl = itemModel('moonPearl'); this.altarPearl.position.set(tp.x, y, tp.z); this.altarPearl.scale.setScalar(1.4); this.scene.add(this.altarPearl);
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.4, 60, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: instant ? 0.25 : 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.beam.position.set(tp.x, y + 30, tp.z); this.scene.add(this.beam);
    if (!instant) for (let i = 0; i < 4; i++) setTimeout(() => this.particles.sparkle(new THREE.Vector3(tp.x, y, tp.z), 0xdfe8ff, 30), i * 300);
  }
  private clearAltar() { this.altarPearl?.removeFromParent(); this.beam?.removeFromParent(); this.altarPearl = null; this.beam = null; }

  // ------------------------------------------------------------------ main loop
  private loop() {
    requestAnimationFrame(() => this.loop());
    const now = performance.now();
    let dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    (window as any).__frames = ((window as any).__frames || 0) + 1;
    this.perfCheck(dt);
    this.input.poll();
    this.time += dt;
    U.uTime.value = this.time;

    if (this.input.keys.has('KeyO') && !this.fsKeyHeld) { this.fsKeyHeld = true; Fullscreen.toggle(); }
    if (!this.input.keys.has('KeyO')) this.fsKeyHeld = false;
    if (this.input.wasPressed('pause') && this.mode !== 'title' && this.mode !== 'create') { if (this.ui.panelOpen) this.ui.closePanel(); else this.ui.pause(); }
    if (this.input.wasPressed('inventory') && this.mode !== 'title' && this.mode !== 'create') { if (this.ui.panelOpen === 'hub') this.ui.closePanel(); else if (!this.ui.dialogOpen) this.openInventory(); }
    if (this.input.wasPressed('map') && this.mode === 'play') { if (this.ui.panelOpen === 'hub') this.ui.closePanel(); else if (!this.ui.dialogOpen) this.openMap(); }

    const paused = !!this.ui.panelOpen;
    if (this.mode === 'title') this.updateTitle(dt);
    else if (this.mode === 'create') this.updateCreate(dt);
    else if (!paused) this.updateGame(dt);
    this.input.endFrame();

    // shared uniforms & render
    U.uCam.value.copy(this.cam.position);
    U.uPlayer.value.copy(this.player.pos).y += 1.0;
    const sp = this.player.pos.clone().setY(this.player.pos.y + 0.8).project(this.cam);
    this.rs.setFocus(clamp(1 - (sp.y * 0.5 + 0.5), 0.3, 0.75));
    this.rs.render();
  }
  private perfCheck(dt: number) {
    if (this.mode !== 'play' || this.autoChecked || this.settings.quality !== 'auto') return;
    this.fpsAcc.push(dt);
    if (this.fpsAcc.length >= 150) {
      const avg = this.fpsAcc.reduce((a, b) => a + b, 0) / this.fpsAcc.length;
      this.fpsAcc = [];
      const fps = 1 / avg;
      if (fps < 32 && this.qLevel !== 'low') { this.qLevel = this.qLevel === 'high' ? 'medium' : 'low'; this.rs.setQuality(profile(this.qLevel)); this.ui.toast(`그래픽 품질을 자동으로 조정했어요 (${this.qLevel === 'medium' ? '중간' : '낮음'})`); }
      else this.autoChecked = true;
    }
  }
  private updateCreate(dt: number) {
    const P = this.player;
    P.yaw += (this.createYaw - P.yaw) * (1 - Math.exp(-dt * 6));
    P.rig.root.rotation.y = P.yaw;
    P.rig.root.position.copy(P.pos);
    P.anim.update(dt, { speed: 0, maxSpeed: 7, grounded: true, vy: 0, turnRate: 0, action: 'none', actionT: 0, combo: 0, landT: 1, dist: 0 });
    // portrait framing: hero on the left on wide screens, upper half on phones
    const narrow = innerWidth < 700;
    const side = narrow ? 0 : 1.1;
    const tx = P.pos.x + Math.cos(this.createYaw0) * side, tz = P.pos.z - Math.sin(this.createYaw0) * side;
    const target = new THREE.Vector3(tx, P.pos.y + (narrow ? 0.35 : 0.85), tz);
    const camPos = new THREE.Vector3(P.pos.x + Math.sin(this.createYaw0) * 4.6, P.pos.y + 1.6, P.pos.z + Math.cos(this.createYaw0) * 4.6);
    this.cam.position.lerp(camPos, 1 - Math.exp(-dt * 5));
    this.cam.lookAt(target);
    this.world.update(dt, this.time, P.pos);
    this.particles.update(dt);
  }
  private createYaw0 = 0.3;
  private updateTitle(dt: number) {
    const a = this.time * 0.05;
    const c = new THREE.Vector3(Math.sin(a) * 52, 30, 22 + Math.cos(a) * 52);
    this.cam.position.lerp(c, 1 - Math.exp(-dt * 2));
    this.cam.lookAt(0, 3, 14);
    this.world.update(dt, this.time, new THREE.Vector3(0, 3, 14));
    this.npcs.forEach((n) => n.update(dt, new THREE.Vector3(999, 0, 999)));
    this.player.anim.update(dt, { speed: 0, maxSpeed: 7, grounded: true, vy: 0, turnRate: 0, action: 'none', actionT: 0, combo: 0, landT: 1, dist: 0 });
    this.particles.update(dt);
    if (this.input.wasPressed('interact') && !this.ui.panelOpen) { this.audio.unlock(); Fullscreen.enter(); Save.read() ? this.continueGame() : this.openCreator(); }
  }

  private updateGame(dtRaw: number) {
    const ui = this.ui, P = this.player;
    // dialog consumes input
    if (ui.resultOpen && (this.input.wasPressed('interact') || this.input.wasPressed('attack'))) { ui.closeResult(); this.input.pressed.clear(); }
    if (ui.dialogOpen) {
      if (this.input.wasPressed('interact') || this.input.wasPressed('attack') || this.input.wasPressed('jump')) ui.advance();
      this.input.pressed.clear();
    }
    if (this.mode === 'itemget') {
      this.itemGetT += dtRaw;
      if (this.itemGetT > 0.8 && (this.input.wasPressed('interact') || this.input.wasPressed('attack') || this.input.wasPressed('jump'))) this.finishItemGet();
      else if (this.itemGetT > 4.5) this.finishItemGet();
      this.input.pressed.clear();
    }
    if (this.mode === 'dead') {
      this.deadT += dtRaw;
      if (this.deadT > 1.6 && !ui.panelOpen) {
        ui.deadPanel();
      }
    }
    if (this.mode === 'play' && !ui.dialogOpen) {
      if (this.input.wasPressed('interact') && this.interactTarget) { this.interactTarget.act(); this.input.consume('interact'); this.input.consume('attack'); }
      if (this.input.wasPressed('tool') && this.fishing.st === 'idle') this.useTool();
      if (this.input.wasPressed('cycle')) this.tools.cycle();
      if (this.input.wasPressed('mount')) this.mount.toggle();
    }
    // hitstop
    let dt = dtRaw;
    if (this.hitstop > 0) { this.hitstop -= dtRaw; dt = dtRaw * 0.05; }
    if (this.mode === 'play' || this.mode === 'dead' || this.mode === 'itemget' || this.mode === 'ending') this.playTime += dtRaw;
    // expansion systems
    if (this.mode === 'play' && !ui.dialogOpen) this.time_.update(dtRaw);
    this.fishing.update(dtRaw); this.fishing.updateContest(this.mode === 'play' ? dtRaw : 0);
    this.cooking.update(this.mode === 'play' ? dtRaw : 0);
    this.minigames.update(this.mode === 'play' ? dtRaw : 0);
    this.tools.update(dt); this.explore.update(dt); this.mount.update(dtRaw);
    if (this.area === 'island') this.life.update(dt);
    P.speedMul = (this.mount.riding ? 1.75 : 1) * this.cooking.speedMul();
    P.defenseMul = this.cooking.defenseMul() * (1 - (this.inv.upgrades.shield ?? 0) * 0.08);
    P.extraHearts = this.cooking.extraHearts();

    // camera input
    const lk = this.input.look;
    if (!ui.dialogOpen) { this.rig.orbit(lk.dx, lk.dy); this.rig.zoom(lk.zoom); }
    if (this.input.keys.has('KeyZ')) this.rig.targetYaw += dtRaw * 1.8;
    if (this.input.keys.has('KeyC')) this.rig.targetYaw -= dtRaw * 1.8;

    P.frozen = P.frozen || ui.dialogOpen || this.mode !== 'play' || this.fishing.st !== 'idle';
    const wasFrozen = P.frozen;
    P.update(dt);
    P.frozen = wasFrozen && (this.mode === 'play' && !ui.dialogOpen) ? false : P.frozen;
    if (this.mode === 'play' && !ui.dialogOpen && this.fishing.st === 'idle') P.frozen = false;

    // combat: player hits
    if (P.attackActive()) {
      const a = P.currentAttack()!;
      const f = P.facing();
      const reachPt = P.pos.clone().addScaledVector(f, a.reach * 0.6).setY(P.pos.y + 0.8);
      for (const e of this.enemies) {
        if (e.dead || e.lastSwing === P.swingId) continue;
        const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z, d = Math.hypot(dx, dz);
        const eh = e.type === 'moth' ? e.pos.y + 1.6 : e.pos.y + 0.6;
        const reach = a.reach + this.inv.weaponReach();
        if (d > reach + e.radius || Math.abs(eh - (P.pos.y + 0.8)) > (e.type === 'boss' ? 3 : 1.6)) continue;
        if (a.arc < 6 && Math.abs(angleDiff(P.yaw, Math.atan2(dx, dz))) > a.arc / 2 + 0.3) continue;
        e.lastSwing = P.swingId; e.damage(a.dmg * this.inv.weaponDmg(), P.pos);
        this.onHitFx(new THREE.Vector3(e.pos.x - dx / d * e.radius * 0.7, eh, e.pos.z - dz / d * e.radius * 0.7));
      }
      // bushes & pots
      const cut = this.world.veg.cutBushAt(reachPt.x, reachPt.z, a.name === 'spin' ? 2.0 : 1.0);
      for (const b of cut) {
        this.particles.leaves(new THREE.Vector3(b.x, b.y + 0.6, b.z)); this.audio.play('cut');
        const r = Math.random(); if (r < 0.28) this.dropItem('shell', new THREE.Vector3(b.x, b.y + 0.5, b.z)); else if (r < 0.38) this.dropItem('heart', new THREE.Vector3(b.x, b.y + 0.5, b.z)); else if (r < 0.45) this.dropItem('berry', new THREE.Vector3(b.x, b.y + 0.5, b.z));
      }
      for (const pot of this.world.pots) if (pot.alive && Math.hypot(pot.x - reachPt.x, pot.z - reachPt.z) < (a.name === 'spin' ? 2.2 : 1.3)) {
        pot.alive = false; pot.obj.visible = false; pot.collider.active = false; this.audio.play('pot');
        this.particles.emit({ pos: new THREE.Vector3(pot.x, pot.y + 0.5, pot.z), count: 14, spread: 3, up: 1.5, life: 0.8, size: 0.25, color: 0xc77a4a, grav: 9 });
        const r = Math.random(); this.dropItem(r < 0.35 ? 'heart' : 'shell', new THREE.Vector3(pot.x, pot.y + 0.6, pot.z), r > 0.8 ? 5 : 1);
      }
    }
    // enemies
    for (const e of this.enemies) {
      e.update(dt);
      if (!e.dead && this.mode === 'play' && e.touching(P.pos.clone().setY(P.pos.y + 0.6))) {
        const r = P.hurt(e.st.dmg, e.pos);
        if (r === 'blocked') { e.knock.copy(e.pos).sub(P.pos).setY(0).normalize().multiplyScalar(6); if (e.state === 'charge') e.state = 'rest'; }
      }
    }
    // projectiles
    for (const s of this.shots) {
      s.life -= dt; s.vel.y -= s.grav * dt; s.mesh.position.addScaledVector(s.vel, dt); s.mesh.rotation.y += dt * 6;
      const g = this.groundAt(s.mesh.position.x, s.mesh.position.z, s.mesh.position.y + 0.5);
      if (s.mesh.position.y < g + 0.1) { s.life = 0; this.particles.poof(s.mesh.position.clone(), 0xd8c0ff); }
      const pp = P.pos.clone().setY(P.pos.y + 0.8);
      if (s.life > 0 && s.mesh.position.distanceTo(pp) < s.radius + 0.45 && this.mode === 'play') {
        const r = P.hurt(s.dmg, s.mesh.position.clone(), 5);
        if (r !== 'ignored') { s.life = 0; this.particles.hit(s.mesh.position.clone()); }
      }
      // wall hit
      if (s.life > 0 && this.world.col.resolve(s.mesh.position.x, s.mesh.position.z, 0.15, s.mesh.position.y - 0.5, 0.6).hit) s.life = 0;
      if (s.life <= 0) s.mesh.removeFromParent();
    }
    this.shots = this.shots.filter((s) => s.life > 0);
    // respawns on the island
    for (const r of this.respawnTimers) { r.t -= dt; if (r.t <= 0 && Math.hypot(r.x - P.pos.x, r.z - P.pos.z) > 32 && this.area === 'island') { this.spawn(r.type, r.x, r.z); r.t = 1e9; } }
    this.respawnTimers = this.respawnTimers.filter((r) => r.t < 1e8);

    // pickups
    for (const k of this.pickups) {
      k.t += dt;
      if (!k.big) {
        k.vel.y -= 16 * dt; k.pos.addScaledVector(k.vel, dt);
        const g = this.groundAt(k.pos.x, k.pos.z, k.pos.y + 0.5) + 0.3;
        if (k.pos.y < g) { k.pos.y = g; k.vel.y = Math.abs(k.vel.y) > 2 ? -k.vel.y * 0.4 : 0; k.vel.x *= 0.6; k.vel.z *= 0.6; }
        const d = k.pos.distanceTo(P.pos.clone().setY(P.pos.y + 0.6));
        if (d < 3 && k.t > 0.5) k.pos.lerp(P.pos.clone().setY(P.pos.y + 0.6), 1 - Math.exp(-dt * 8));
        if (d < 0.8 && k.t > 0.4) { this.collect(k); continue; }
        if (k.t > 20) { k.obj.removeFromParent(); (k as any).done = true; continue; }
        k.obj.visible = k.t < 16 || Math.floor(k.t * 8) % 2 === 0;
      } else {
        k.pos.y += Math.sin(k.t * 2) * 0.004;
        if (k.pos.distanceTo(P.pos.clone().setY(k.pos.y)) < 1.4 && this.mode === 'play') { this.collect(k); continue; }
        if (Math.random() < 0.1) this.particles.sparkle(k.pos.clone(), 0xdfe8ff, 1);
      }
      k.obj.position.copy(k.pos).setY(k.pos.y + Math.sin(k.t * 3) * 0.08);
      k.obj.rotation.y += dt * 2;
    }
    this.pickups = this.pickups.filter((k) => !(k as any).done);

    // chests lid animation
    for (const c of this.chests.values()) if (c.opened && c.openT < 1) { c.openT = Math.min(1, c.openT + dt * 2.2); c.obj.lid.rotation.x = -1.9 * (1 - Math.pow(1 - c.openT, 3)); }

    // puzzles
    const moving = this.input.move();
    const isMoving = Math.hypot(moving.x, moving.y) > 0.3 && this.mode === 'play';
    const canMove = (b: PushBlock, bounds: (x: number, z: number) => boolean) => (x: number, z: number) => {
      if (!bounds(x, z)) return false;
      const g0 = b.groundAt(b.col.x, b.col.z), g1 = b.groundAt(x, z);
      if (Math.abs(g1 - g0) > 0.35) return false;
      for (const c of this.world.col.query(x, z, 1.2)) if (c !== b.col && c.solid && c.tag !== 'bush' && this.world.col.inside(c, x, z, 0.9) && c.y1 > g1 + 0.3) return false;
      return true;
    };
    if (this.area === 'island') {
      if (!this.quest.has('ruinsOpen')) {
        this.ruinsBlock.tryPush(P.pos, P.facing(), isMoving, dt, canMove(this.ruinsBlock, (x, z) => Math.hypot(x - 56, z - 48) < 12 && z < 52));
        this.ruinsPlate.update(dt, [this.ruinsBlock]);
        if (this.ruinsPlate.pressed) { this.quest.set('ruinsOpen'); this.ruinsGate.setOpen(true); this.audio.play('solve'); this.ui.toast('폐허의 문이 열렸어요!'); this.shake(0.3); this.save(); }
      }
      this.ruinsBlock.update(dt); this.ruinsGate.update(dt);
    } else {
      const D = this.dungeon;
      D.blockB.tryPush(P.pos, P.facing(), isMoving, dt, canMove(D.blockB, (x, z) => Math.abs(x - DX) < 7.5 && Math.abs(z + 20) < 5.5));
      if (D.plateB.pressed && !D.gateB.open) { D.gateB.setOpen(true); this.audio.play('solve'); this.ui.toast('철문이 열렸어요!'); this.save(); }
      D.update(dt, this.time);
      // boss room trigger
      const room = D.roomAt(P.pos.x, P.pos.z);
      if (this.boss && room === 3 && !this.boss.dead) { this.ui.boss(this.boss.hp / this.boss.maxHp); this.audio.setTheme('boss'); }
      if (room === 2) this.checkRoomClear();
    }

    // NPCs
    for (const n of this.npcs) n.update(dt, P.pos);
    this.npcs.forEach((n, i) => { const m = this.qm.marker(n.id); const sp = this.markers[i] as any; if (sp.last !== m) { sp.last = m; sp.draw(m); } if (m) sp.position.y = 2.15 + Math.sin(this.time * 3) * 0.08; });
    const ab = this.arenaBoss;
    if (ab && !ab.dead && ab.state !== 'idle') { this.ui.boss(ab.hp / ab.maxHp, ({ guardian: '이끼숲 수호자', kingCrab: '대왕소라게', storm: '폭풍해파리' } as Record<string, string>)[ab.type] ?? ''); this.audio.setTheme('boss'); }
    if (this.area === 'island') { const ci = Math.floor((P.pos.x + WORLD_HALF) / (WORLD_HALF * 2) * 64), cj = Math.floor((P.pos.z + WORLD_HALF) / (WORLD_HALF * 2) * 64);
      for (let dj = -4; dj <= 4; dj++) for (let di = -4; di <= 4; di++) if (di * di + dj * dj <= 18) { const i = ci + di, j = cj + dj; if (i >= 0 && j >= 0 && i < 64 && j < 64) this.discovered[j * 64 + i] = 1; } }
    ui.clock(this.area === 'island' ? this.time_.label() : this.area === 'dungeon' ? '물빛 동굴' : this.area === 'grove' ? '수호자의 숲' : '하늘 정원');
    ui.buffs(this.cooking.buffs); ui.tracker(this.qm);
    this.touch.setCtx(this.mount.friend && this.area === 'island' ? (this.mount.riding ? '내리기' : '늑대') : null);
    // altar beam
    if (this.beam) { const m = this.beam.material as THREE.MeshBasicMaterial; m.opacity = damp(m.opacity, 0.22 + Math.sin(this.time * 2) * 0.04, 1.5, dt); this.altarPearl!.rotation.y += dt; }

    // interaction prompt
    this.interactTarget = this.mode === 'play' && !ui.dialogOpen ? this.findInteract() : null;
    ui.prompt(this.interactTarget?.label ?? null, this.touch.enabled);
    this.touch.setActLabel(this.interactTarget ? '조사' : null);

    // camera
    this.rig.update(dtRaw, P.pos, P.vel);
    // lantern glow in the cave
    this.lantern.intensity = damp(this.lantern.intensity, this.area === 'dungeon' && this.inv.has('lantern') ? 7 : 0, 4, dtRaw);
    this.lantern.position.copy(P.pos).add(new THREE.Vector3(0, 2.2, 0));

    // world
    this.world.update(dt, this.time, P.pos);
    // lighting is driven by TimeWeather (clock + weather)
    this.particles.update(dt);
    // chimney smoke drifting with the wind
    if (this.area === 'island') for (const c of this.world.chimneys) if (Math.random() < dt * 5 && c.distanceTo(P.pos) < 60) this.particles.emit({ pos: c, vel: new THREE.Vector3(0.5, 1.3, 0.25), count: 1, spread: 0.15, life: 2.8, size: 0.55, grow: 2.4, color: 0xf2eee8, grav: -0.05, drag: 0.25 });
    if (Math.random() < 0.08 && this.area === 'island') this.particles.emit({ pos: P.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 24, 1 + Math.random() * 3, (Math.random() - 0.5) * 24)), count: 1, spread: 0.3, life: 3, size: 0.09, color: 0xfffbe0, additive: true, grav: -0.05, drag: 0.2 });

    // HUD
    ui.hearts(P.hp, P.maxHp); ui.shells(this.inv.count('shell'));
    this.updateRegion();
    this.updateGuide();
    this.minimap.draw(P.pos.x, P.pos.z, P.yaw, this.rig.yaw, this.area === 'dungeon', this.dungeon.roomAt(P.pos.x, P.pos.z));
    if (P.hp <= 2 && P.hp > 0 && Math.floor(this.time * 1.2) !== Math.floor((this.time - dtRaw) * 1.2)) this.audio.play('lowHp');
  }
  private collect(k: Pickup) {
    k.obj.removeFromParent(); (k as any).done = true;
    const P = this.player;
    if (k.id === 'heart') { P.heal(2); this.audio.play('heal'); }
    else if (k.id === 'shell') { this.inv.add('shell', k.count); this.audio.play('smallGet'); }
    else if (k.id === 'berry') { this.inv.add('berry', k.count); this.audio.play('smallGet'); this.ui.toast('회복 열매를 주웠어요'); }
    else if (['material', 'ammo', 'food'].includes(ITEMS[k.id]?.kind as string)) { this.inv.add(k.id, k.count); this.audio.play('smallGet'); this.ui.toast(`${ITEMS[k.id].name} ×${k.count}`); }
    else { this.giveItem(k.id, k.count); return; }
    this.particles.sparkle(k.pos.clone(), k.id === 'heart' ? 0xff8aa0 : 0xfff0d0, 6);
  }
  private updateRegion() {
    const P = this.player.pos;
    if (this.area === 'grove' || this.area === 'sky') return;
    const r: Region = this.area === 'dungeon' ? 'cave' : this.world.hf.regionAt(P.x, P.z);
    if (r === this.region) return;
    this.codex.see('places', r);
    const first = this.region === '';
    this.region = r;
    this.ui.areaName(REGION_NAMES[r]);
    if (!first || this.area === 'dungeon') this.ui.region(REGION_NAMES[r], this.area === 'dungeon' ? 'DUNGEON' : 'AREA');
    const theme: Record<Region, any> = { meadow: 'meadow', forest: 'forest', coast: 'beach', beach: 'beach', mountain: 'mountain', lake: 'meadow', cave: 'dungeon', village: 'village', ruins: 'forest', temple: 'temple' };
    if (!(this.boss && !this.boss.dead && this.area === 'dungeon')) this.audio.setTheme(this.quest.has('ending') && r === 'temple' ? 'temple' : theme[r]);
    const wind = r === 'mountain' || r === 'temple' || r === 'coast' ? 1 : r === 'cave' ? 0.2 : 0.45;
    const waves = r === 'beach' || r === 'coast' ? 1 : r === 'lake' ? 0.35 : r === 'cave' ? 0 : 0.12;
    this.audio.setAmbience(wind, waves);
  }
  private updateDayCycle(dt: number) {
    if (this.area !== 'island') return;
    // slow drift morning -> afternoon -> golden hour and back (~12 minutes per loop)
    this.dayT += dt / 720;
    const k = 0.5 - 0.5 * Math.cos(this.dayT * Math.PI * 2);
    const az = -0.9 + k * 1.4, el = 0.95 - k * 0.45;
    const d = this.world.sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
    void d;
    this.world.sun.color.setHSL(0.1 - k * 0.03, 0.6 + k * 0.3, 0.88 - k * 0.12);
    this.world.sun.intensity = 2.7 - k * 0.5;
    this.world.hemi.intensity = 1.05 - k * 0.2;
    (this.world.water.material as THREE.ShaderMaterial).uniforms.uSun.value.copy(this.world.sunDir);
  }
  updateMarkers() {
    const m = this.minimap.markers; m.length = 0;
    for (const n of L.NPCS) m.push({ x: n.x, z: n.z, color: '#ffffff', kind: 'npc' });
    for (const c of this.chests.values()) if (!c.opened && !c.def.dungeon) m.push({ x: c.def.x, z: c.def.z, color: '#f2c14c', kind: 'chest' });
    const goal = this.goal('island');
    if (goal) m.push({ x: goal.x, z: goal.z, color: '#f07a50', kind: 'goal' });
  }
  /** Where the current objective physically is (for the on-screen guide arrow and minimap star). */
  /** Coarse objective direction: points at the destination area, not at the exact object,
   *  so players still explore. No guidance inside the cave (it is a straight run). */
  goal(area: string = this.area): { x: number; z: number; y: number; label: string } | null {
    if (area !== 'island') return null;
    const q = this.qm.activeMain(); const t = q?.target; if (!t) return null;
    // coarse guidance: villages/area centres rather than exact objects
    const coarse: Record<string, [number, number, string]> = { m1: [0, 22, '솔방울 마을'], m2: [0, 22, '솔방울 마을'], m3: [56, 50, '옛 등대 폐허'] };
    const c = coarse[q!.id];
    const [x, z, label] = c ?? [t.x, t.z, t.label];
    return { x, z, label, y: this.world.hf.height(x, z) };
  }
  private updateGuide() {
    const g = this.mode === 'play' && !this.ui.dialogOpen ? this.goal() : null;
    if (!g) { this.ui.guide(null); this.guideMesh.visible = false; return; }
    const P = this.player.pos;
    const dist = Math.hypot(g.x - P.x, g.z - P.z);
    // once the player is in the destination area, stop guiding and let them look around
    if (dist < 28) { this.ui.guide(null); this.guideMesh.visible = false; return; }
    this.guideMesh.visible = false;
    this.guideMesh.position.set(g.x, g.y + 3.4 + Math.sin(this.time * 3) * 0.25, g.z);
    this.guideMesh.rotation.y = this.time * 2;
    // screen-space arrow
    const v = new THREE.Vector3(g.x, g.y + 2.2, g.z).project(this.cam);
    const behind = v.z > 1;
    let sx = (v.x * 0.5 + 0.5) * innerWidth, sy = (-v.y * 0.5 + 0.5) * innerHeight;
    if (behind) { sx = innerWidth - sx; sy = innerHeight - sy; }
    const m = 70, onScreen = !behind && sx > m && sx < innerWidth - m && sy > m && sy < innerHeight - m;
    const cx = innerWidth / 2, cy = innerHeight / 2;
    let ang = Math.atan2(sy - cy, sx - cx);
    if (behind && Math.abs(sx - cx) < 1 && Math.abs(sy - cy) < 1) ang = Math.PI / 2;
    if (!onScreen) {
      // clamp to an inset rectangle along the direction from the centre
      const hw = cx - m, hh = cy - m, dx = Math.cos(ang), dy = Math.sin(ang);
      const k = Math.min(hw / Math.abs(dx || 1e-6), hh / Math.abs(dy || 1e-6));
      sx = cx + dx * k; sy = cy + dy * k;
      // keep clear of the hearts/quest card (top-left) and minimap (top-right)
      if (sy < 190 && (sx < 300 || sx > innerWidth - 220)) sy = 190;
    }
    this.ui.guide({ x: sx, y: sy, angle: ang, onScreen, label: g.label, dist: Math.round(dist) });
  }
}
