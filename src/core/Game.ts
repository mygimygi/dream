import * as THREE from 'three';
import { RenderSystem } from '../render/Renderer';
import { U } from '../render/Materials';
import { Particles } from '../render/Particles';
import { World, ChestEnt } from '../world/World';
import { REGION_NAMES, Region } from '../world/Heightfield';
import * as L from '../world/Layout';
import { chest as chestModel } from '../world/Props';
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
import { UI } from '../ui/UI';
import { Minimap } from '../ui/Minimap';
import { AudioSystem } from '../audio/Audio';
import { Save, SaveData, Settings } from '../save/Save';
import { TouchControls } from '../mobile/TouchControls';
import { Dungeon, DUNGEON_ENTRY, DX, ROOMS } from '../dungeon/Dungeon';
import { Gate, Plate, PushBlock } from '../puzzle/Puzzles';
import { Fullscreen } from '../mobile/Fullscreen';

type Mode = 'title' | 'play' | 'itemget' | 'dead' | 'ending' | 'transition';
interface Pickup { obj: THREE.Object3D; id: string; pos: THREE.Vector3; vel: THREE.Vector3; t: number; big: boolean; count: number; }

export class Game {
  scene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.3, 900);
  rs: RenderSystem; world: World; rig: CameraRig; input: Input; player: Player; inv = new Inventory(); quest: Quest;
  ui = new UI(); audio = new AudioSystem(); particles: Particles; minimap: Minimap; touch: TouchControls; dungeon: Dungeon;
  npcs: NPC[] = []; enemies: Enemy[] = []; shots: Projectile[] = []; pickups: Pickup[] = [];
  chests = new Map<string, ChestEnt>();
  ruinsBlock: PushBlock; ruinsPlate: Plate; ruinsGate: Gate;
  mode: Mode = 'title'; time = 0; playTime = 0; hitstop = 0; area: 'island' | 'dungeon' = 'island';
  settings: Settings; qLevel: QualityLevel;
  private region: Region | '' = ''; private lastFrame = performance.now(); private fpsAcc: number[] = []; private autoChecked = false;
  private itemGetT = 0; private pendingItem: { id: string; count: number } | null = null; private deadT = 0;
  private lantern: THREE.PointLight; private interactTarget: { label: string; act: () => void } | null = null;
  private boss: Enemy | null = null; private altarPearl: THREE.Object3D | null = null; private beam: THREE.Mesh | null = null;
  private respawnTimers: { type: EnemyType; x: number; z: number; t: number }[] = [];
  private guideMesh: THREE.Mesh;
  private dayT = 0.32; private fsKeyHeld = false;

  constructor(canvas: HTMLCanvasElement) {
    this.settings = Save.settings();
    const urlQ = new URLSearchParams(location.search).get('q') as QualityLevel | null;
    this.qLevel = urlQ ?? (this.settings.quality === 'auto' ? detectQuality() : this.settings.quality);
    const q = profile(this.qLevel);
    this.rs = new RenderSystem(canvas, this.scene, this.cam);
    this.world = new World(this.scene, q);
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
      this.npcs.push(npc); this.world.col.circle(n.x, n.z, 0.45, -5, 5);
    }
    // ruins puzzle
    const P = L.RUINS_PUZZLE;
    this.ruinsBlock = new PushBlock(this.scene, this.world.col, P.block.x, P.block.z, (x, z) => this.world.hf.height(x, z), 'ruins');
    this.ruinsPlate = new Plate(this.scene, P.plate.x, P.plate.z, this.world.hf.height(P.plate.x, P.plate.z));
    this.ruinsGate = new Gate(this.scene, this.world.col, P.gate.x, P.gate.z, this.world.hf.height(P.gate.x, P.gate.z) - 0.2, P.gate.yaw, 3.6);
    this.world.onSign = (text) => this.say([{ who: '', text: text.replace(/\n/g, ' · ') }]);
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
        case 'new': this.audio.unlock(); Fullscreen.enter(); this.newGame(); break;
        case 'continue': this.audio.unlock(); Fullscreen.enter(); this.continueGame(); break;
        case 'fullscreen': Fullscreen.toggle(); if (ui.panelOpen === 'pause') ui.closePanel(); break;
        case 'settings': ui.settings(this.settings); break;
        case 'help': ui.help(this.touch.enabled); break;
        case 'back': if (this.mode === 'title') ui.closePanel(); else ui.pause(); break;
        case 'close': ui.closePanel(); break;
        case 'pause': if (this.mode !== 'title') ui.pause(); break;
        case 'inventory': if (this.mode !== 'title') this.openInventory(); break;
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
  }
  private openInventory() {
    const t = Math.floor(this.playTime);
    this.ui.inventory(this.inv, { shells: this.inv.count('shell'), stars: this.inv.count('starShard'), time: `${Math.floor(t / 60)}분 ${t % 60}초`, hp: this.player.hp, max: this.player.maxHp });
  }
  private useItem(id: string) {
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
    this.rig.targetYaw = this.player.yaw + Math.PI; this.rig.targetPitch = this.area === 'dungeon' ? 1.02 : 0.8; this.rig.targetDist = this.area === 'dungeon' ? 21 : 19;
    this.rig.snap(this.player.pos);
    this.ui.hearts(this.player.hp, this.player.maxHp); this.ui.shells(this.inv.count('shell'));
    this.ui.equip(this.inv, this.touch.enabled);
    events.emit('quest');
    this.region = '';
    this.fpsAcc = []; this.autoChecked = false;
  }
  newGame() {
    this.inv.load({}); this.quest.load([]); this.playTime = 0;
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
    this.say([{ who: '미루', text: '음… 바람 소리가 하나도 안 들려. 소라 할머니한테 가 봐야겠다.' }]);
  }
  continueGame() {
    const d = Save.read(); if (!d) { this.newGame(); return; }
    this.inv.load(d.inventory); this.quest.load(d.flags); this.playTime = d.playTime ?? 0;
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
  save() {
    if (this.mode === 'title') return;
    const p = this.player.pos;
    const D = this.dungeon;
    const d: SaveData = {
      v: 1, time: Date.now(), pos: [p.x, p.y, p.z], yaw: this.player.yaw, area: this.area, hp: this.player.hp,
      inventory: this.inv.toJSON(), flags: this.quest.toJSON(), chests: [...this.chests.values()].filter((c) => c.opened).map((c) => c.def.id),
      bushes: this.world.veg.bushes.filter((b) => !b.alive).map((b) => b.index), pots: this.world.pots.filter((x) => !x.alive).map((x) => x.id),
      dungeon: { torches: D.torchesA.torches.map((t) => t.lit), block: [D.blockB.col.x, D.blockB.col.z], doorC: D.doorC.open, bossDead: this.quest.has('bossDead'), keyChest: this.quest.has('keyChest') },
      playTime: this.playTime,
    };
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
    if (this.area === 'dungeon') { this.player.place(DUNGEON_ENTRY.x, DUNGEON_ENTRY.z, DUNGEON_ENTRY.yaw); this.spawnDungeon(); }
    else { this.player.place(L.START.x, L.START.z, L.START.yaw); this.spawnIsland(); }
    this.rig.snap(this.player.pos);
    this.mode = 'play'; this.ui.hearts(this.player.hp, this.player.maxHp);
  }

  // ------------------------------------------------------------------ areas & spawning
  private clearEnemies() { for (const e of this.enemies) e.dispose(); this.enemies = []; for (const s of this.shots) s.mesh.removeFromParent(); this.shots = []; this.respawnTimers = []; this.boss = null; this.ui.boss(null); }
  private env() { return { groundAt: (x: number, z: number, m?: number) => this.groundAt(x, z, m), col: this.world.col, playerPos: this.player.pos, playerAlive: () => this.player.action !== 'dead' && this.mode === 'play' }; }
  private spawn(type: EnemyType, x: number, z: number) { const e = new Enemy(type, x, z, this.scene, this.env(), this.shots); e.onDeath = (en) => this.onEnemyDeath(en); this.enemies.push(e); return e; }
  private spawnIsland() { for (const s of L.ENEMY_SPAWNS) this.spawn(s.type as EnemyType, s.x, s.z); }
  private spawnDungeon() {
    if (!this.quest.has('roomB')) { this.spawn('moth', DX - 3, -22); this.spawn('moth', DX + 3, -17); }
    if (!this.quest.has('keyChest')) { this.spawn('moth', DX - 4, -38); this.spawn('moth', DX + 4, -42); this.spawn('moth', DX, -36); this.spawn('crab', DX - 5, -43); this.spawn('crab', DX + 5, -37); }
    if (!this.quest.has('bossDead')) { this.boss = this.spawn('boss', DX, -70); this.boss.yaw = 0; }
  }
  private setArea(a: 'island' | 'dungeon', instant = false) {
    this.area = a;
    const w = this.world, s = this.scene;
    if (a === 'dungeon') {
      s.background = new THREE.Color(0x05080c); s.fog = new THREE.Fog(0x0a1620, 22, 60);
      w.hemi.color.set(0x7fa8c8); w.hemi.groundColor.set(0x1a2a30); w.hemi.intensity = 0.55; w.sun.intensity = 0.35; w.sun.color.set(0x9fc8ff);
      w.water.visible = false;
      this.rs.grade.uniforms.uVig.value = 0.5;
    } else {
      s.background = new THREE.Color(0xd6f0ff); s.fog = new THREE.Fog(0xd6f0ff, 95, 260);
      w.hemi.color.set(0xcfe9ff); w.hemi.groundColor.set(0x7a9a4a); w.hemi.intensity = 1.25; w.sun.intensity = 2.7; w.sun.color.set(0xfff0d6);
      w.water.visible = true;
      this.rs.grade.uniforms.uVig.value = 0.32;
    }
    this.dungeon.group.visible = a === 'dungeon';
    this.rig.targetPitch = a === 'dungeon' ? 1.02 : 0.8; this.rig.targetDist = a === 'dungeon' ? 21 : 19;
    void instant;
  }
  private transitionTo(a: 'island' | 'dungeon', x: number, z: number, yaw: number) {
    this.mode = 'transition'; this.ui.fade(true); this.audio.play('door');
    setTimeout(() => {
      this.clearEnemies();
      this.setArea(a);
      this.player.place(x, z, yaw);
      if (a === 'dungeon') this.spawnDungeon(); else this.spawnIsland();
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
    const r = Math.random();
    if (r < 0.3 && this.player.hp < this.player.maxHp) this.dropItem('heart', p);
    else if (r < 0.75) this.dropItem('shell', p, Math.random() < 0.25 ? 5 : 1);
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
      e.lastSwing = this.player.swingId; e.damage(2, p, 9); this.onHitFx(e.pos.clone().setY(e.pos.y + 0.8));
    }
  }
  private onHitFx(at: THREE.Vector3) { this.particles.hit(at); this.audio.play('hit'); this.hitstop = 0.065; this.shake(0.22); }

  // ------------------------------------------------------------------ interaction
  private findInteract(): { label: string; act: () => void } | null {
    const p = this.player.pos, f = this.player.facing();
    const near = (x: number, z: number, r: number) => Math.hypot(x - p.x, z - p.z) < r;
    const facing = (x: number, z: number) => { const dx = x - p.x, dz = z - p.z, l = Math.hypot(dx, dz) || 1; return (dx * f.x + dz * f.z) / l > 0.2; };
    for (const n of this.npcs) if (this.area === 'island' && near(n.pos.x, n.pos.z, 2.4)) return { label: `${n.name}와 대화하기`, act: () => this.talk(n) };
    for (const c of this.chests.values()) if (!c.opened && c.visible && near(c.def.x, c.def.z, 2.2) && facing(c.def.x, c.def.z)) return { label: '상자 열기', act: () => this.openChest(c) };
    if (this.area === 'island') {
      for (const s of this.world.signs) if (near(s.x, s.z, 2) && facing(s.x, s.z)) return { label: '읽기', act: () => this.say([{ who: '표지판', text: s.text.replace(/\n/g, ' ') }]) };
      const rb = this.ruinsBlock, o = L.RUINS_PUZZLE.block;
      if (!this.quest.has('ruinsOpen') && !rb.moving && near(rb.col.x, rb.col.z, 2.4) && (rb.col.x !== o.x || rb.col.z !== o.z)) return { label: '돌을 제자리로 되돌리기', act: () => this.resetBlock(rb, o.x, o.z) };
      if (near(L.CAVE.x, L.CAVE.z, 4.8)) return { label: '물빛 동굴로 들어가기', act: () => this.enterCave() };
      if (near(L.TEMPLE_POS.x, L.TEMPLE_POS.z, 2.8)) return { label: this.inv.has('moonPearl') ? '달진주 바치기' : '제단 살펴보기', act: () => this.altar() };
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
  private talk(n: NPC) {
    n.talking = true;
    if (n.id === 'elder') this.quest.set('metElder');
    this.say(this.quest.npcLines(n.id), (v) => {
      n.talking = false;
      if (v === 'buyBerry') {
        if (this.inv.take('shell', 10)) { this.inv.add('berry'); this.ui.shells(this.inv.count('shell')); this.audio.play('smallGet'); this.say([{ who: '다래', text: '고마워! 맛있게 먹어. 체력이 떨어지면 가방에서 꺼내 먹으면 돼.' }]); }
        else this.say([{ who: '다래', text: '어라, 조개가 모자라네. 풀숲이나 항아리를 살펴보면 조개가 나올 거야!' }]);
      }
      if (n.id === 'elder') events.emit('quest');
    });
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
    if (!this.inv.has('lantern')) { this.say([{ who: '미루', text: '안이 너무 깜깜해서 한 발짝도 못 들어가겠어. 등불이 있어야 해.' }]); return; }
    this.quest.set('enteredCave');
    this.transitionTo('dungeon', DUNGEON_ENTRY.x, DUNGEON_ENTRY.z, DUNGEON_ENTRY.yaw);
  }
  private unlockDoor() {
    if (!this.inv.has('smallKey')) { this.say([{ who: '미루', text: '단단히 잠겨 있어. 작은 열쇠가 필요해 보여.' }]); return; }
    this.inv.take('smallKey'); this.dungeon.doorC.setOpen(true); this.audio.play('solve'); this.ui.equip(this.inv, this.touch.enabled); this.save();
  }
  private lightTorch(i: number) {
    if (!this.inv.has('lantern')) { this.say([{ who: '미루', text: '불을 붙일 무언가가 필요해.' }]); return; }
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
  private useTool() {
    const tool = this.inv.equipped.tool;
    if (!tool) { this.ui.toast('장착한 도구가 없어요'); return; }
    if (tool === 'lantern') {
      this.player.action = 'interact'; this.player.actionT = 0;
      const p = this.player.pos.clone().add(this.player.facing().multiplyScalar(1.2)).setY(this.player.pos.y + 1.2);
      this.particles.sparkle(p, 0x9fe8ff, 10); this.audio.play('torch');
      if (this.area === 'dungeon') { const ti = this.dungeon.torchesA.nearest(this.player.pos, 2.8); if (ti >= 0) this.lightTorch(ti); }
    }
  }
  private altar() {
    if (this.quest.has('ending')) { this.say([{ who: '', text: '달진주가 제단 위에서 은은하게 빛나고 있다. 섬에 기분 좋은 바람이 분다.' }]); return; }
    if (!this.inv.has('moonPearl')) { this.say([{ who: '', text: '둥근 홈이 파인 제단이다. 무언가를 올려 두었던 자리 같다.' }]); return; }
    this.inv.take('moonPearl'); this.quest.set('ending');
    this.mode = 'ending';
    this.placeAltarPearl(false);
    this.audio.play('solve'); this.audio.setTheme('temple'); this.shake(0.4);
    this.rig.targetDist = 17; this.rig.targetPitch = 0.55;
    setTimeout(() => { this.save(); const t = Math.floor(this.playTime); this.ui.credits({ time: `${Math.floor(t / 60)}분 ${t % 60}초`, stars: this.inv.count('starShard') }); }, 3200);
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
    if (this.input.wasPressed('pause') && this.mode !== 'title') { if (this.ui.panelOpen) this.ui.closePanel(); else this.ui.pause(); }
    if (this.input.wasPressed('inventory') && this.mode !== 'title') { if (this.ui.panelOpen === 'inventory') this.ui.closePanel(); else if (!this.ui.dialogOpen) this.openInventory(); }

    const paused = !!this.ui.panelOpen;
    if (this.mode === 'title') this.updateTitle(dt);
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
  private updateTitle(dt: number) {
    const a = this.time * 0.05;
    const c = new THREE.Vector3(Math.sin(a) * 52, 30, 22 + Math.cos(a) * 52);
    this.cam.position.lerp(c, 1 - Math.exp(-dt * 2));
    this.cam.lookAt(0, 3, 14);
    this.world.update(dt, this.time, new THREE.Vector3(0, 3, 14));
    this.npcs.forEach((n) => n.update(dt, new THREE.Vector3(999, 0, 999)));
    this.player.anim.update(dt, { speed: 0, maxSpeed: 7, grounded: true, vy: 0, turnRate: 0, action: 'none', actionT: 0, combo: 0, landT: 1, dist: 0 });
    this.particles.update(dt);
    if (this.input.wasPressed('interact') && !this.ui.panelOpen) { this.audio.unlock(); Fullscreen.enter(); Save.read() ? this.continueGame() : this.newGame(); }
  }

  private updateGame(dtRaw: number) {
    const ui = this.ui, P = this.player;
    // dialog consumes input
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
      if (this.input.wasPressed('tool')) this.useTool();
    }
    // hitstop
    let dt = dtRaw;
    if (this.hitstop > 0) { this.hitstop -= dtRaw; dt = dtRaw * 0.05; }
    if (this.mode === 'play' || this.mode === 'dead' || this.mode === 'itemget' || this.mode === 'ending') this.playTime += dtRaw;

    // camera input
    const lk = this.input.look;
    if (!ui.dialogOpen) { this.rig.orbit(lk.dx, lk.dy); this.rig.zoom(lk.zoom); }
    if (this.input.keys.has('KeyZ')) this.rig.targetYaw += dtRaw * 1.8;
    if (this.input.keys.has('KeyC')) this.rig.targetYaw -= dtRaw * 1.8;

    P.frozen = P.frozen || ui.dialogOpen || this.mode !== 'play';
    const wasFrozen = P.frozen;
    P.update(dt);
    P.frozen = wasFrozen && (this.mode === 'play' && !ui.dialogOpen) ? false : P.frozen;
    if (this.mode === 'play' && !ui.dialogOpen) P.frozen = false;

    // combat: player hits
    if (P.attackActive()) {
      const a = P.currentAttack()!;
      const f = P.facing();
      const reachPt = P.pos.clone().addScaledVector(f, a.reach * 0.6).setY(P.pos.y + 0.8);
      for (const e of this.enemies) {
        if (e.dead || e.lastSwing === P.swingId) continue;
        const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z, d = Math.hypot(dx, dz);
        const eh = e.type === 'moth' ? e.pos.y + 1.6 : e.pos.y + 0.6;
        if (d > a.reach + e.radius || Math.abs(eh - (P.pos.y + 0.8)) > (e.type === 'boss' ? 3 : 1.6)) continue;
        if (a.arc < 6 && Math.abs(angleDiff(P.yaw, Math.atan2(dx, dz))) > a.arc / 2 + 0.3) continue;
        e.lastSwing = P.swingId; e.damage(a.dmg, P.pos);
        this.onHitFx(new THREE.Vector3(e.pos.x - dx / d * e.radius * 0.7, eh, e.pos.z - dz / d * e.radius * 0.7));
      }
      // bushes & pots
      const cut = this.world.veg.cutBushAt(reachPt.x, reachPt.z, a.name === 'spin' ? 2.0 : 1.0);
      for (const b of cut) {
        this.particles.leaves(new THREE.Vector3(b.x, b.y + 0.6, b.z)); this.audio.play('cut');
        const r = Math.random(); if (r < 0.28) this.dropItem('shell', new THREE.Vector3(b.x, b.y + 0.5, b.z)); else if (r < 0.38) this.dropItem('heart', new THREE.Vector3(b.x, b.y + 0.5, b.z));
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
    this.updateDayCycle(dtRaw);
    this.particles.update(dt);
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
    else { this.giveItem(k.id, k.count); return; }
    this.particles.sparkle(k.pos.clone(), k.id === 'heart' ? 0xff8aa0 : 0xfff0d0, 6);
  }
  private updateRegion() {
    const P = this.player.pos;
    const r: Region = this.area === 'dungeon' ? 'cave' : this.world.hf.regionAt(P.x, P.z);
    if (r === this.region) return;
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
    this.world.hemi.intensity = 1.25 - k * 0.2;
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
  goal(area: 'island' | 'dungeon' = this.area): { x: number; z: number; y: number; label: string } | null {
    const s = this.quest.stage();
    const at = (x: number, z: number, label: string, y?: number) => ({ x, z, label, y: y ?? (x > 500 ? 0 : this.world.hf.height(x, z)) });
    if (area === 'dungeon') {
      const D = this.dungeon;
      if (s >= 5 || this.quest.has('bossDead')) { const k = this.pickups.find((p) => p.big); return k ? at(k.pos.x, k.pos.z, '보상') : at(DX, 8.5, '출구'); }
      if (!D.gateA.open) { const i = D.torchesA.torches.findIndex((t) => !t.lit); const t = D.torchesA.torches[i]; return at(t.position.x, t.position.z, '횃불'); }
      if (!D.gateB.open) { const pl = D.plateB; return Math.hypot(this.player.pos.x - DX, this.player.pos.z + 20) < 10 ? at(pl.x, pl.z, '돌을 발판 위로') : at(DX, -20, '다음 방'); }
      const key = this.chests.get('d_key')!;
      if (!key.opened) return this.quest.has('keyChest') ? at(key.def.x, key.def.z, '열쇠 상자') : at(DX, -40, '나방 물리치기');
      if (!D.doorC.open) return at(DX, -46.5, '잠긴 문');
      return at(DX, -66, '보스');
    }
    switch (s) {
      case 0: return at(-9, 17, '소라 할머니');
      case 1: return at(17.5, 17, '검 상자');
      case 2: return this.quest.has('ruinsOpen') ? at(56, 59, '등불 상자') : at(this.ruinsBlock.col.x, this.ruinsBlock.col.z, '무거운 돌');
      case 3: case 4: return this.area === 'dungeon' ? null : at(L.CAVE.x, L.CAVE.z, '물빛 동굴');
      case 5: return at(L.TEMPLE_POS.x, L.TEMPLE_POS.z, '달빛 사원');
      default: return null;
    }
  }
  private updateGuide() {
    const g = this.mode === 'play' && !this.ui.dialogOpen ? this.goal() : null;
    if (!g) { this.ui.guide(null); this.guideMesh.visible = false; return; }
    const P = this.player.pos;
    const dist = Math.hypot(g.x - P.x, g.z - P.z);
    // 3D beacon over the goal
    this.guideMesh.visible = dist > 2.5;
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
    }
    this.ui.guide({ x: sx, y: sy, angle: ang, onScreen, label: g.label, dist: Math.round(dist) });
  }
}
