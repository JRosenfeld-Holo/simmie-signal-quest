import Phaser from 'phaser';
import { SaveService } from '../services/SaveService';
import { MuteService }  from '../services/MuteService';
import { LEVELS, type LevelConfig } from '../levels/LevelData';

// ─── Constants ────────────────────────────────────────────────────────────────
const WORLD_WIDTH  = 5200;
const WORLD_HEIGHT = 640;

const BASE_SPEED    = 310;
const JUMP_VEL      = -570;
const JUMP_VEL2     = -510;
const DRAG_X        = 1100;

const COYOTE_TIME   = 100;
const JUMP_BUFFER   = 100;

const LIME   = 0xbffd11;
const NAVY   = 0x0f172a;
const DARK   = 0x1e293b;
const SLATE  = 0x334155;
const RED    = 0xff3b3b;
const WHITE  = 0xffffff;

// ─── Scene ────────────────────────────────────────────────────────────────────
export default class GameScene extends Phaser.Scene {

  // ── Upgrade values (loaded from save) ─────────────────────────────────────
  private upgSpeed           = BASE_SPEED;
  private upgradePacketMagnet = false;

  // ── Game objects ──────────────────────────────────────────────────────────
  private player!:          Phaser.Physics.Arcade.Sprite;
  private platforms!:       Phaser.Physics.Arcade.StaticGroup;
  private dataPackets!:     Phaser.Physics.Arcade.StaticGroup;
  private latencyBugs!:     Phaser.Physics.Arcade.Group;
  private cellTower!:       Phaser.Physics.Arcade.StaticGroup;
  private checkpoints!:     Phaser.Physics.Arcade.StaticGroup;
  private globalSims!:      Phaser.Physics.Arcade.StaticGroup;
  private outageShields!:   Phaser.Physics.Arcade.StaticGroup;
  private speedBoostPads!:  Phaser.Physics.Arcade.StaticGroup;
  private roamingParticles!: Phaser.GameObjects.Particles.ParticleEmitter;

  // ── Input ─────────────────────────────────────────────────────────────────
  private cursors!:  Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!:     Phaser.Input.Keyboard.Key;
  private keyD!:     Phaser.Input.Keyboard.Key;
  private keyW!:     Phaser.Input.Keyboard.Key;
  private keyEsc!:   Phaser.Input.Keyboard.Key;

  // ── Touch input ───────────────────────────────────────────────────────────
  private touchLeft           = false;
  private touchRight          = false;
  private touchJumpTriggered  = false;

  // ── Player state ──────────────────────────────────────────────────────────
  private score        = 0;
  private jumpCount    = 0;
  private signalBars   = 4;
  private maxBars      = 4;
  private invincible   = false;
  private roaming      = false;
  private roamingTimer = 0;
  private shieldActive   = false;
  private shieldTimer    = 0;
  private shieldGlow: Phaser.GameObjects.Graphics | null = null;
  private wasOnGround  = false;
  private gameOver     = false;
  private victory      = false;
  private gamePaused   = false;

  // ── Juice timers ──────────────────────────────────────────────────────────
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;

  // ── Tweens ────────────────────────────────────────────────────────────────
  private roamingFlashTween: Phaser.Tweens.Tween | null = null;
  private pauseOverlay: Phaser.GameObjects.Container | null = null;

  // ── Animation state machine ───────────────────────────────────────────────
  private playerAnimState: 'idle' | 'walk' | 'airUp' | 'airDown' = 'idle';
  private runDustEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private landDustEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;

  // ── Parallax layers ───────────────────────────────────────────────────────
  private bgTile1!: Phaser.GameObjects.TileSprite;
  private bgTile2!: Phaser.GameObjects.TileSprite;

  // ── UI ────────────────────────────────────────────────────────────────────
  private scoreText!:       Phaser.GameObjects.Text;
  private signalBarGfx!:    Phaser.GameObjects.Graphics;
  private roamingBarGfx!:   Phaser.GameObjects.Graphics;
  private progressBarGfx!:  Phaser.GameObjects.Graphics;
  private roamingBarLabel!: Phaser.GameObjects.Text;

  // ── Level system ──────────────────────────────────────────────────────────
  private currentLevel = 0;
  private carryScore   = 0;
  private lvl!: LevelConfig;

  // ── Audio ─────────────────────────────────────────────────────────────────
  private levelMusic: Phaser.Sound.BaseSound | null = null;

  // ── Boss (Level 5 only) ───────────────────────────────────────────────────
  private boss:           Phaser.Physics.Arcade.Sprite | null = null;
  private bossHP         = 5;
  private bossMaxHP      = 5;
  private bossHPBarGfx:  Phaser.GameObjects.Graphics | null = null;
  private bossHPBarBg:   Phaser.GameObjects.Graphics | null = null;
  private bossHPLabel:   Phaser.GameObjects.Text     | null = null;
  private bossProjs:     Phaser.Physics.Arcade.Group | null = null;
  private bossFireTimer: Phaser.Time.TimerEvent       | null = null;
  private bossPhase      = 0;   // 0 normal | 1 angry (≤3 HP) | 2 enraged (≤1 HP)
  private bossDefeated   = false;

  constructor() { super({ key: 'GameScene' }); }

  init(data?: { level?: number; score?: number }) {
    this.currentLevel = data?.level ?? 0;
    this.carryScore   = data?.score ?? 0;
    // Reset state fields for scene restart
    this.score = 0;
    this.gameOver = false;
    this.victory  = false;
    this.roaming  = false;
    this.roamingTimer = 0;
    this.invincible = false;
    this.jumpCount = 0;
    this.wasOnGround = false;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.playerAnimState = 'idle';
    this.roamingFlashTween = null;
    this.gamePaused = false;
    this.levelMusic = null;
    this.touchLeft  = false;
    this.touchRight = false;
    this.touchJumpTriggered = false;
    this.boss = null;
    this.bossHP = 5;
    this.bossPhase = 0;
    this.bossDefeated = false;
    this.bossFireTimer = null;
    this.bossProjs = null;
    this.bossHPBarGfx = null;
    this.bossHPBarBg = null;
    this.bossHPLabel = null;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // PRELOAD
  // ────────────────────────────────────────────────────────────────────────────
  preload() {
    this.load.svg('simmie', '/assets/Simmie.svg', { width: 72, height: 63 });
    const musicKey  = `music_level${this.currentLevel + 1}`;
    const musicFile = this.currentLevel < 5
      ? `/assets/music/Level ${this.currentLevel + 1}.mp3`
      : null;
    if (musicFile && !this.cache.audio.has(musicKey)) {
      this.load.audio(musicKey, musicFile);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // CREATE
  // ────────────────────────────────────────────────────────────────────────────
  create() {
    // Apply saved upgrades
    const save = SaveService.load();
    const boost = save.upgrades.bandwidthBoost;
    this.upgSpeed = Math.round(BASE_SPEED * (1 + boost * 0.15));
    this.upgradePacketMagnet = save.upgrades.packetSniffer;
    this.maxBars    = save.upgrades.signalAmp ? 5 : 4;
    this.signalBars = this.maxBars;

    // ── Load level data ──
    this.lvl   = LEVELS[this.currentLevel] ?? LEVELS[0];
    this.score = this.carryScore;

    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT + 300);
    this.physics.world.setBoundsCollision(true, true, true, false);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    this.buildBackground();
    this.buildPlatforms();
    this.buildDataPackets();
    this.buildLatencyBugs();
    this.buildCheckpoints();
    this.buildGlobalSims();
    this.buildCellTower();
    this.buildOutageShields();
    this.buildSpeedBoosts();
    this.createDustTextures();
    this.buildPlayer();
    this.buildDustEmitters();
    this.buildRoamingParticles();
    this.buildLevelProps();
    this.buildUI();
    this.setupInput();
    this.setupCollisions();

    // ── Start level music ────────────────────────────────────────────────────
    this.sound.stopAll();
    this.sound.mute = MuteService.isMuted();
    const musicKey = `music_level${this.currentLevel + 1}`;
    if (this.cache.audio.has(musicKey)) {
      this.levelMusic = this.sound.add(musicKey, { loop: true, volume: 0.5 });
      this.levelMusic.play();
    }
    this.events.on('shutdown', () => { this.levelMusic?.stop(); });

    // ── Touch controls (mobile/tablet only) ─────────────────────────────────
    if (this.sys.game.device.input.touch) this.buildTouchControls();

    // ── Build boss if Level 5 ────────────────────────────────────────────────
    if (this.currentLevel === 4) this.buildBoss();

    this.cameras.main.startFollow(this.player, true, 0.1, 0.08);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // UPDATE
  // ────────────────────────────────────────────────────────────────────────────
  update(_time: number, delta: number) {
    // Parallax scrolling — runs even during gameOver/victory
    const camX = this.cameras.main.scrollX;
    this.bgTile1.setTilePosition(camX * 0.07, 0);
    this.bgTile2.setTilePosition(camX * 0.25, 0);

    if (this.gameOver || this.victory || this.gamePaused) return;

    this.handleMovement(delta);
    this.refreshProgressBar();
    this.patrolBugs();
    this.tickRoaming(delta);
    this.tickShield(delta);
    this.maybeApplyMagnet();
    this.checkPitDeath();
    if (this.currentLevel === 4) {
      this.tickBoss();
      if (!this.boss?.getData('active') && this.player.x > 4100) this.activateBoss();
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Build helpers
  // ────────────────────────────────────────────────────────────────────────────

  private buildBackground() {
    // Solid navy base
    this.add.rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH, WORLD_HEIGHT, NAVY).setDepth(0);
    // Grid
    const g = this.add.graphics().setDepth(1);
    g.lineStyle(1, 0x1e293b, 0.5);
    for (let x = 0; x <= WORLD_WIDTH; x += 120) { g.moveTo(x, 0); g.lineTo(x, WORLD_HEIGHT); }
    for (let y = 0; y <= WORLD_HEIGHT; y += 120) { g.moveTo(0, y); g.lineTo(WORLD_WIDTH, y); }
    g.strokePath();
    // Dots
    const rng = this.add.graphics().setDepth(1);
    for (let i = 0; i < 140; i++) {
      rng.fillStyle(LIME, Phaser.Math.FloatBetween(0.05, 0.3));
      rng.fillCircle(Phaser.Math.Between(0, WORLD_WIDTH), Phaser.Math.Between(0, WORLD_HEIGHT), Phaser.Math.Between(1, 3));
    }
    this.buildParallaxBg();
  }

  private buildParallaxBg() {
    // ── Layer 1: City silhouettes — generate once, reuse on retry ──
    const W1 = 1280, H1 = 300;
    if (!this.textures.exists('parallax_bg1')) {
      const g1 = this.make.graphics({ x: 0, y: 0 });
      for (let i = 0; i < 14; i++) {
        const bx = Phaser.Math.Between(10, W1 - 60);
        const bw = Phaser.Math.Between(40, 90);
        const bh = Phaser.Math.Between(60, 200);
        g1.fillStyle(0x0d1526, 0.9);
        g1.fillRect(bx, H1 - bh, bw, bh);
        for (let wy = H1 - bh + 8; wy < H1 - 10; wy += 16) {
          for (let wx = bx + 6; wx < bx + bw - 6; wx += 12) {
            g1.fillStyle(0x1e3a5f, Phaser.Math.FloatBetween(0.2, 0.6));
            g1.fillRect(wx, wy, 5, 7);
          }
        }
      }
      for (let i = 0; i < 4; i++) {
        const ax = Phaser.Math.Between(50, W1 - 50);
        g1.lineStyle(1, 0x1a2744, 0.7);
        g1.beginPath(); g1.moveTo(ax, H1 - 180); g1.lineTo(ax, H1 - 250); g1.strokePath();
        g1.fillStyle(RED, 0.4); g1.fillCircle(ax, H1 - 252, 2);
      }
      g1.generateTexture('parallax_bg1', W1, H1); g1.destroy();
    }
    this.bgTile1 = this.add.tileSprite(640, 576 - 150, 1280, H1, 'parallax_bg1')
      .setScrollFactor(0).setDepth(1).setAlpha(0.7);

    // ── Layer 2: Server racks + hex nodes — generate once, reuse on retry ──
    const W2 = 1280, H2 = 180;
    if (!this.textures.exists('parallax_bg2')) {
      const g2 = this.make.graphics({ x: 0, y: 0 });
      for (let i = 0; i < 9; i++) {
        const sx = Phaser.Math.Between(20, W2 - 40);
        for (let r = 0; r < 3; r++) {
          const ry = H2 - 20 - r * 18;
          g2.fillStyle(0x162236, 0.8); g2.fillRect(sx, ry, 28, 14);
          g2.fillStyle(LIME, 0.5); g2.fillCircle(sx + 4, ry + 7, 2);
          g2.fillStyle(0xff8800, 0.4); g2.fillCircle(sx + 10, ry + 7, 2);
        }
      }
      for (let i = 0; i < 8; i++) {
        const hx = Phaser.Math.Between(30, W2 - 30), hy = Phaser.Math.Between(20, H2 - 30);
        const pts: { x: number; y: number }[] = [];
        for (let a = 0; a < 6; a++) {
          const angle = (Math.PI / 3) * a - Math.PI / 6;
          pts.push({ x: hx + Math.cos(angle) * 8, y: hy + Math.sin(angle) * 8 });
        }
        g2.lineStyle(1, LIME, 0.15);
        g2.strokePoints(pts as unknown as Phaser.Geom.Point[], true);
      }
      g2.generateTexture('parallax_bg2', W2, H2); g2.destroy();
    }
    this.bgTile2 = this.add.tileSprite(640, 576 - 90, 1280, H2, 'parallax_bg2')
      .setScrollFactor(0).setDepth(2).setAlpha(0.6);

    // ── Layer 3: Wire segments + floaters (individual objects, scrollFactor 0.55) ──
    for (let i = 0; i < 7; i++) {
      const wx = Phaser.Math.Between(100, WORLD_WIDTH - 100);
      const wy = Phaser.Math.Between(80, 576 - 100);
      const wire = this.add.graphics().setDepth(3).setScrollFactor(0.55);
      wire.lineStyle(1, LIME, 0.2);
      wire.beginPath();
      wire.moveTo(wx, wy);
      wire.lineTo(wx + Phaser.Math.Between(-80, 80), wy + Phaser.Math.Between(-40, 40));
      wire.strokePath();
      // Connector dots
      wire.fillStyle(LIME, 0.3); wire.fillCircle(wx, wy, 3);
    }
    for (let i = 0; i < 10; i++) {
      const fx = Phaser.Math.Between(50, WORLD_WIDTH - 50);
      const fy = Phaser.Math.Between(50, 576 - 80);
      const floater = this.add.graphics().setDepth(3).setScrollFactor(0.55);
      floater.fillStyle(LIME, 0.15);
      if (i % 2 === 0) {
        // Diamond
        const dp = [{ x: fx, y: fy - 6 }, { x: fx + 6, y: fy }, { x: fx, y: fy + 6 }, { x: fx - 6, y: fy }];
        floater.fillPoints(dp as unknown as Phaser.Geom.Point[], true);
      } else {
        floater.fillRect(fx - 4, fy - 4, 8, 8);
      }
      this.tweens.add({ targets: floater, alpha: { from: 0.15, to: 0.4 }, duration: Phaser.Math.Between(1500, 3000), yoyo: true, repeat: -1 });
    }
  }

  private buildPlatforms() {
    this.platforms = this.physics.add.staticGroup();
    for (const [lx, ty, w, h = 22] of this.lvl.platforms) {
      this.addPlatform(lx, ty, w, h);
    }
    this.platforms.setDepth(5);
  }

  private addPlatform(leftX: number, topY: number, width: number, height = 22) {
    const key = `plat_${width}_${height}`;
    if (!this.textures.exists(key)) {
      const g = this.make.graphics({ x: 0, y: 0 });
      // Dark body
      g.fillStyle(DARK); g.fillRect(0, 0, width, height);
      // Lime top strip
      g.fillStyle(LIME); g.fillRect(0, 0, width, 4);
      g.fillStyle(0x2d3f55); g.fillRect(0, 4, width, 2);
      // Circuit trace: horizontal line at y=10
      if (height > 14) {
        g.lineStyle(1, 0x253348, 0.7);
        g.beginPath(); g.moveTo(4, 10); g.lineTo(width - 4, 10); g.strokePath();
        // Vertical branch traces
        const branchCount = Math.floor(width / (width / 5));
        for (let b = 0; b < branchCount; b++) {
          const bx = Math.round((b + 1) * width / (branchCount + 1));
          g.beginPath(); g.moveTo(bx, 10); g.lineTo(bx, Math.min(10 + 6, height - 2)); g.strokePath();
        }
      }
      // Indicator lights in the lime top strip
      const lightCount = Math.min(4, Math.max(2, Math.floor(width / 60)));
      for (let li = 0; li < lightCount; li++) {
        const lx = Math.round(6 + li * ((width - 12) / (lightCount - 1 || 1)));
        g.fillStyle(li % 2 === 0 ? LIME : 0xff8800);
        g.fillRect(lx, 0, 4, 4);
      }
      g.generateTexture(key, width, height);
      g.destroy();
    }
    const p = this.platforms.create(
      leftX + width / 2, topY + height / 2, key
    ) as Phaser.Physics.Arcade.Image;
    p.refreshBody();
  }

  private buildDataPackets() {
    this.dataPackets = this.physics.add.staticGroup();
    if (!this.textures.exists('datapacket')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      // Dark circuit board body
      g.fillStyle(0x0d1f0d); g.fillRect(0, 0, 20, 20);
      // 1px lime grid traces
      g.lineStyle(1, LIME, 0.4);
      for (let tx = 4; tx < 20; tx += 5) { g.beginPath(); g.moveTo(tx, 0); g.lineTo(tx, 20); g.strokePath(); }
      for (let ty = 4; ty < 20; ty += 5) { g.beginPath(); g.moveTo(0, ty); g.lineTo(20, ty); g.strokePath(); }
      // 4 lime corner contact pads
      g.fillStyle(LIME, 0.8);
      g.fillRect(0, 0, 3, 3); g.fillRect(17, 0, 3, 3);
      g.fillRect(0, 17, 3, 3); g.fillRect(17, 17, 3, 3);
      // Bright center core
      g.fillStyle(LIME); g.fillRect(7, 7, 6, 6);
      g.fillStyle(WHITE, 0.7); g.fillRect(8, 8, 4, 4);
      g.generateTexture('datapacket', 20, 20);
      g.destroy();
    }
    for (const [x, y] of this.lvl.packets) this.dataPackets.create(x, y, 'datapacket');
    this.tweens.add({
      targets: this.dataPackets.getChildren(),
      alpha: { from: 1, to: 0.5 },
      duration: 700,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    this.dataPackets.setDepth(6);
  }

  private buildLatencyBugs() {
    this.latencyBugs = this.physics.add.group();
    if (!this.textures.exists('latencybug')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      // 3 body segments (rounded rects in reds)
      g.fillStyle(0xcc2222); g.fillRoundedRect(2, 10, 12, 14, 3);   // rear
      g.fillStyle(RED);      g.fillRoundedRect(12, 8, 14, 18, 4);   // torso
      g.fillStyle(0xff5555); g.fillRoundedRect(24, 12, 10, 12, 3);  // head
      // 4 L-shaped legs
      g.lineStyle(2, 0x991111, 0.9);
      g.beginPath(); g.moveTo(8, 24); g.lineTo(4, 30); g.strokePath();
      g.beginPath(); g.moveTo(14, 26); g.lineTo(12, 30); g.strokePath();
      g.beginPath(); g.moveTo(20, 26); g.lineTo(22, 30); g.strokePath();
      g.beginPath(); g.moveTo(28, 24); g.lineTo(32, 30); g.strokePath();
      // 2 antenna arcs
      g.lineStyle(1, 0xff8888, 0.7);
      g.beginPath(); g.arc(30, 12, 6, -2.5, -1.2, false); g.strokePath();
      g.beginPath(); g.arc(30, 12, 6, -1.9, -0.6, false); g.strokePath();
      // Single large red eye with pupil+highlight
      g.fillStyle(WHITE); g.fillCircle(29, 16, 4);
      g.fillStyle(RED);   g.fillCircle(30, 16, 3);
      g.fillStyle(WHITE, 0.9); g.fillCircle(31, 15, 1);
      g.generateTexture('latencybug', 36, 32);
      g.destroy();
    }
    for (const [x, y, range] of this.lvl.bugs) {
      const bug = this.latencyBugs.create(x, y, 'latencybug') as Phaser.Physics.Arcade.Sprite;
      bug.setVelocityX(this.lvl.bugSpeed);
      bug.setData('startX', x);
      bug.setData('range', range);
      // ScaleX oscillation tween
      this.tweens.add({
        targets: bug, scaleX: { from: 0.9, to: 1.0 },
        duration: 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }
    this.latencyBugs.setDepth(6);
  }

  private buildCheckpoints() {
    this.checkpoints = this.physics.add.staticGroup();
    // Build hexagonal beacon textures
    const buildHexBeacon = (key: string, bodyColor: number, glowColor: number, active: boolean) => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ x: 0, y: 0 });
      const cx = 22, cy = 20, r = 16;
      // Hexagon points
      const hex: { x: number; y: number }[] = [];
      for (let a = 0; a < 6; a++) {
        const angle = (Math.PI / 3) * a - Math.PI / 2;
        hex.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
      }
      // Pole
      g.fillStyle(SLATE); g.fillRect(19, 36, 6, 24);
      g.fillStyle(DARK);  g.fillRect(14, 54, 16, 6);
      // Hex body
      g.fillStyle(bodyColor);
      g.fillPoints(hex as unknown as Phaser.Geom.Point[], true);
      g.lineStyle(2, glowColor, 0.6);
      g.strokePoints(hex as unknown as Phaser.Geom.Point[], true);
      if (active) {
        // Light cone triangle (alpha 0.12)
        g.fillStyle(glowColor, 0.12);
        const cone = [{ x: cx - 14, y: cy + 16 }, { x: cx + 14, y: cy + 16 }, { x: cx, y: cy + 40 }];
        g.fillPoints(cone as unknown as Phaser.Geom.Point[], true);
        // Bright center
        g.fillStyle(glowColor, 0.9); g.fillCircle(cx, cy, 5);
        g.fillStyle(WHITE, 0.6); g.fillCircle(cx, cy, 3);
      } else {
        g.fillStyle(0x64748b, 0.5); g.fillCircle(cx, cy, 4);
      }
      g.generateTexture(key, 44, 60); g.destroy();
    };
    buildHexBeacon('checkpoint', SLATE, 0x94a3b8, false);
    buildHexBeacon('checkpoint_active', 0x1a3a1a, LIME, true);

    for (const [x, platformTopY] of this.lvl.checkpoints) {
      const cp = this.checkpoints.create(x, platformTopY - 30, 'checkpoint') as Phaser.Physics.Arcade.Image;
      cp.setData('activated', false);
      cp.setSize(22, 56);
      cp.refreshBody();
      // Pulsing arrow above
      const arrow = this.add.text(x, platformTopY - 85, '▲  CHECKPOINT', {
        fontFamily: 'Inter, sans-serif', fontSize: '12px',
        color: '#94a3b8', stroke: '#0f172a', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(5);
      this.tweens.add({
        targets: arrow, y: arrow.y - 5, alpha: { from: 1, to: 0.4 },
        duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }
  }

  private buildGlobalSims() {
    this.globalSims = this.physics.add.staticGroup();
    if (!this.textures.exists('globalsim')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      const ox = 4, oy = 9, sw = 32, sh = 28, notch = 9;
      // SIM card polygon (notched top-right corner)
      const simPts = [
        { x: ox, y: oy }, { x: ox + sw - notch, y: oy }, { x: ox + sw, y: oy + notch },
        { x: ox + sw, y: oy + sh }, { x: ox, y: oy + sh },
      ];
      // Purple body
      g.fillStyle(0x8b5cf6);
      g.fillPoints(simPts as unknown as Phaser.Geom.Point[], true);
      // Darker edge
      g.lineStyle(2, 0x6d28d9, 0.9);
      g.strokePoints(simPts as unknown as Phaser.Geom.Point[], true);
      // Lime chip area with grid
      g.fillStyle(LIME, 0.8); g.fillRect(ox + 8, oy + 8, 16, 12);
      g.lineStyle(1, 0x0d1f0d, 0.5);
      for (let cx = ox + 12; cx < ox + 24; cx += 4) { g.beginPath(); g.moveTo(cx, oy + 8); g.lineTo(cx, oy + 20); g.strokePath(); }
      for (let cy = oy + 12; cy < oy + 20; cy += 4) { g.beginPath(); g.moveTo(ox + 8, cy); g.lineTo(ox + 24, cy); g.strokePath(); }
      // 2 peeking eyes above
      g.fillStyle(WHITE); g.fillCircle(14, 5, 4); g.fillCircle(26, 5, 4);
      g.fillStyle(0x6d28d9); g.fillCircle(15, 6, 2); g.fillCircle(27, 6, 2);
      g.fillStyle(WHITE, 0.9); g.fillCircle(16, 5, 1); g.fillCircle(28, 5, 1);
      g.generateTexture('globalsim', 40, 40);
      g.destroy();
    }
    for (const [x, y] of this.lvl.sims) {
      const sim = this.globalSims.create(x, y, 'globalsim') as Phaser.Physics.Arcade.Image;
      sim.refreshBody();
    }
    this.tweens.add({
      targets: this.globalSims.getChildren(),
      y: `+=12`, duration: 900,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    // Dynamic labels for all SIMs
    const simLabels: Phaser.GameObjects.Text[] = [];
    for (const [sx, sy] of this.lvl.sims) {
      const lbl = this.add.text(sx, sy - 30, '★ GLOBAL SIM', {
        fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#bffd11',
      }).setOrigin(0.5).setDepth(5);
      simLabels.push(lbl);
    }
    if (simLabels.length > 0) {
      this.tweens.add({
        targets: simLabels,
        alpha: { from: 1, to: 0.3 }, duration: 600, yoyo: true, repeat: -1,
      });
    }
    this.globalSims.setDepth(6);
  }

  private buildCellTower() {
    this.cellTower = this.physics.add.staticGroup();
    if (!this.textures.exists('celltower')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      const tw = 90, th = 150, cx = tw / 2;
      // Wider base
      g.fillStyle(SLATE); g.fillRect(cx - 6, 25, 12, 120);
      // 4 strut levels
      g.fillStyle(DARK);
      g.fillRect(cx - 24, 50, 48, 5);
      g.fillRect(cx - 20, 75, 40, 5);
      g.fillRect(cx - 16, 100, 32, 5);
      g.fillRect(cx - 12, 120, 24, 5);
      // Strut diagonals
      g.lineStyle(1, SLATE, 0.5);
      g.beginPath(); g.moveTo(cx - 24, 50); g.lineTo(cx - 6, 75); g.strokePath();
      g.beginPath(); g.moveTo(cx + 24, 50); g.lineTo(cx + 6, 75); g.strokePath();
      g.beginPath(); g.moveTo(cx - 20, 75); g.lineTo(cx - 6, 100); g.strokePath();
      g.beginPath(); g.moveTo(cx + 20, 75); g.lineTo(cx + 6, 100); g.strokePath();
      // Top platform
      g.fillStyle(LIME); g.fillRect(cx - 12, 10, 24, 8); g.fillRect(cx - 5, 18, 10, 10);
      // 4 signal arc rings
      const arcs: [number, number][] = [[20, 0.95], [30, 0.65], [40, 0.40], [50, 0.22]];
      for (const [rad, alpha] of arcs) {
        g.lineStyle(2, LIME, alpha);
        g.beginPath(); g.arc(cx, 8, rad, -2.2, -0.94, false); g.strokePath();
      }
      // 8-spoke starburst at tip
      g.lineStyle(1, LIME, 0.7);
      for (let s = 0; s < 8; s++) {
        const angle = (Math.PI / 4) * s;
        g.beginPath();
        g.moveTo(cx, 8);
        g.lineTo(cx + Math.cos(angle) * 10, 8 + Math.sin(angle) * 10);
        g.strokePath();
      }
      // White center dot
      g.fillStyle(WHITE); g.fillCircle(cx, 8, 3);
      g.generateTexture('celltower', tw, th); g.destroy();
    }
    const tX = this.lvl.towerX, tY = this.lvl.towerY;
    const t = this.cellTower.create(tX, tY, 'celltower') as Phaser.Physics.Arcade.Image;
    t.setData('active', true);
    t.refreshBody();
    this.tweens.add({ targets: t, alpha: { from: 1.0, to: 0.85 }, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const lbl = this.add.text(tX, tY - 100, '▲  CELL TOWER', {
      fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#bffd11',
      stroke: '#0f172a', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(5);
    this.tweens.add({ targets: lbl, y: lbl.y - 6, alpha: { from: 1, to: 0.5 }, duration: 900, yoyo: true, repeat: -1 });
  }

  private buildOutageShields() {
    this.outageShields = this.physics.add.staticGroup();
    if (!this.textures.exists('outageshield')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      const sz = 36, cx = sz / 2;
      // Outer shield hexagon
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        pts.push({ x: cx + Math.cos(a) * 15, y: cx + Math.sin(a) * 15 });
      }
      g.fillStyle(0x22d3ee, 0.3);
      g.fillPoints(pts as unknown as Phaser.Geom.Point[], true);
      g.lineStyle(2, 0x22d3ee, 0.9);
      g.strokePoints(pts as unknown as Phaser.Geom.Point[], true);
      // Inner shield icon (upward chevron)
      g.lineStyle(3, WHITE, 0.9);
      g.beginPath(); g.moveTo(cx - 7, cx + 4); g.lineTo(cx, cx - 6); g.lineTo(cx + 7, cx + 4); g.strokePath();
      // Small dot at top
      g.fillStyle(0x22d3ee); g.fillCircle(cx, cx - 8, 3);
      g.generateTexture('outageshield', sz, sz); g.destroy();
    }
    for (const [x, y] of this.lvl.shields) {
      const s = this.outageShields.create(x, y, 'outageshield') as Phaser.Physics.Arcade.Image;
      s.refreshBody();
    }
    // Float animation
    this.tweens.add({
      targets: this.outageShields.getChildren(),
      y: `+=10`, duration: 1100,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    // Labels
    for (const [sx, sy] of this.lvl.shields) {
      const lbl = this.add.text(sx, sy - 28, '🛡 OUTAGE PROTECTION', {
        fontFamily: 'Inter, sans-serif', fontSize: '10px', color: '#22d3ee',
      }).setOrigin(0.5).setDepth(5);
      this.tweens.add({ targets: lbl, alpha: { from: 1, to: 0.4 }, duration: 700, yoyo: true, repeat: -1 });
    }
    this.outageShields.setDepth(6);
  }

  private buildSpeedBoosts() {
    this.speedBoostPads = this.physics.add.staticGroup();
    if (this.lvl.speedBoosts.length === 0) return;
    if (!this.textures.exists('speedboost')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      const pw = 48, ph = 20;
      // Orange pad base
      g.fillStyle(0xff8c00, 0.8); g.fillRect(0, 4, pw, ph - 4);
      g.lineStyle(2, 0xffaa00, 1); g.strokeRect(0, 4, pw, ph - 4);
      // Bright arrow chevrons
      g.lineStyle(3, WHITE, 0.9);
      g.beginPath(); g.moveTo(12, 16); g.lineTo(20, 8); g.lineTo(12, 4); g.strokePath();
      g.beginPath(); g.moveTo(24, 16); g.lineTo(32, 8); g.lineTo(24, 4); g.strokePath();
      g.beginPath(); g.moveTo(36, 16); g.lineTo(44, 8); g.lineTo(36, 4); g.strokePath();
      g.generateTexture('speedboost', pw, ph); g.destroy();
    }
    for (const [x, y] of this.lvl.speedBoosts) {
      const pad = this.speedBoostPads.create(x, y, 'speedboost') as Phaser.Physics.Arcade.Image;
      pad.refreshBody();
    }
    // Glow pulse
    this.tweens.add({
      targets: this.speedBoostPads.getChildren(),
      alpha: { from: 1, to: 0.6 }, duration: 400,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    this.speedBoostPads.setDepth(5);
  }

  private buildPlayer() {
    this.player = this.physics.add.sprite(120, 480, 'simmie');
    this.player.setCollideWorldBounds(true);
    this.player.setDragX(DRAG_X);
    this.player.setDepth(8);
    this.player.setSize(36, 54);
    this.player.setOffset(18, 8);
  }

  private buildRoamingParticles() {
    if (!this.textures.exists('particle')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(LIME); g.fillCircle(4, 4, 4);
      g.generateTexture('particle', 8, 8);
      g.destroy();
    }
    this.roamingParticles = this.add.particles(0, 0, 'particle', {
      follow:        this.player,
      followOffset:  { x: 0, y: 15 },
      speed:         { min: 15, max: 70 },
      scale:         { start: 0.9, end: 0 },
      alpha:         { start: 0.85, end: 0 },
      lifespan:      380,
      blendMode:     Phaser.BlendModes.ADD,
      frequency:     22,
      quantity:       2,
      emitting:      false,
    }).setDepth(6);
  }

  private createDustTextures() {
    if (!this.textures.exists('dustparticle')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x94a3b8); g.fillCircle(3, 3, 3);
      g.generateTexture('dustparticle', 6, 6);
      g.destroy();
    }
  }

  private buildDustEmitters() {
    this.runDustEmitter = this.add.particles(0, 0, 'dustparticle', {
      follow:       this.player,
      followOffset: { x: 0, y: 28 },
      speed:        { min: 10, max: 40 },
      angle:        { min: 160, max: 200 },
      scale:        { start: 0.8, end: 0 },
      alpha:        { start: 0.5, end: 0 },
      lifespan:     300,
      frequency:    40,
      quantity:     1,
      emitting:     false,
      gravityY:     30,
    }).setDepth(7);

    this.landDustEmitter = this.add.particles(0, 0, 'dustparticle', {
      speed:    { min: 20, max: 80 },
      angle:    { min: 120, max: 240 },
      scale:    { start: 1.0, end: 0 },
      alpha:    { start: 0.6, end: 0 },
      lifespan: 350,
      frequency: -1,  // explode mode
      quantity:  8,
      gravityY:  40,
    }).setDepth(7);
  }

  private updatePlayerAnimation(onGround: boolean, velX: number, velY: number) {
    let newState: 'idle' | 'walk' | 'airUp' | 'airDown';
    if (!onGround) {
      newState = velY < 0 ? 'airUp' : 'airDown';
    } else {
      const wasWalking = this.playerAnimState === 'walk';
      const threshold = wasWalking ? 12 : 35;
      newState = Math.abs(velX) > threshold ? 'walk' : 'idle';
    }

    const entering = newState !== this.playerAnimState;
    this.playerAnimState = newState;

    switch (newState) {
      case 'idle':
        if (entering && !this.player.getData('squashing')) {
          this.runDustEmitter.stop();
          this.player.setRotation(0);
        }
        break;
      case 'walk': {
        // Lean rotation based on direction
        const lean = this.player.flipX ? 0.08 : -0.08;
        this.player.setRotation(lean);
        // Start run dust if not already emitting
        if (!this.runDustEmitter.emitting) this.runDustEmitter.start();
        break;
      }
      case 'airUp':
        this.runDustEmitter.stop();
        // Slight backward tilt
        this.player.setRotation(this.player.flipX ? 0.10 : -0.10);
        break;
      case 'airDown':
        this.runDustEmitter.stop();
        // Slight forward lean
        this.player.setRotation(this.player.flipX ? -0.06 : 0.06);
        break;
    }
  }

  private buildLevelProps() {
    // Server rack props
    if (!this.textures.exists('server_rack_prop')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x162236); g.fillRect(0, 0, 50, 66);
      g.fillStyle(0x1e293b); g.fillRect(3, 3, 44, 18); g.fillRect(3, 24, 44, 18); g.fillRect(3, 45, 44, 18);
      g.fillStyle(LIME, 0.6); g.fillCircle(8, 12, 2); g.fillCircle(8, 33, 2); g.fillCircle(8, 54, 2);
      g.fillStyle(0xff8800, 0.4); g.fillCircle(14, 12, 2); g.fillCircle(14, 33, 2); g.fillCircle(14, 54, 2);
      g.lineStyle(1, 0x253348, 0.5); g.strokeRect(0, 0, 50, 66);
      g.generateTexture('server_rack_prop', 50, 66); g.destroy();
    }
    const rackPositions = [
      [150, 440], [600, 440], [1050, 350], [1600, 440],
      [2200, 415], [2800, 375], [3500, 415], [4100, 305],
    ];
    for (const [rx, ry] of rackPositions) {
      this.add.image(rx, ry, 'server_rack_prop').setScrollFactor(0.85).setAlpha(0.7).setDepth(4);
    }

    // Floating network nodes
    if (!this.textures.exists('network_node')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      const dp = [{ x: 7, y: 0 }, { x: 14, y: 7 }, { x: 7, y: 14 }, { x: 0, y: 7 }];
      g.fillStyle(LIME, 0.4);
      g.fillPoints(dp as unknown as Phaser.Geom.Point[], true);
      g.lineStyle(1, LIME, 0.6);
      g.strokePoints(dp as unknown as Phaser.Geom.Point[], true);
      g.generateTexture('network_node', 14, 14); g.destroy();
    }
    const nodePositions = [
      [200, 200], [500, 150], [900, 180], [1300, 220], [1700, 160],
      [2100, 190], [2600, 140], [3100, 210], [3600, 170], [4200, 150],
    ];
    for (let i = 0; i < nodePositions.length; i++) {
      const [nx, ny] = nodePositions[i];
      const node = this.add.image(nx, ny, 'network_node').setDepth(3);
      this.tweens.add({
        targets: node, y: ny + 8,
        duration: Phaser.Math.Between(1500, 2500), delay: i * 200,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }

    // Data cable lines — hand-tuned per level
    const cablesByLevel: Record<number, [number, number, number, number][]> = {
      0: [[370,460,600,460],[1270,370,1380,460],[1820,380,1890,295],[2530,350,2620,270],[3780,350,3920,435]],
      1: [[760,445,900,400],[1510,415,1740,335],[2200,395,2440,315],[3630,280,3830,405]],
      2: [[560,455,700,375],[1430,325,1620,255],[2460,295,2680,395],[3860,285,4060,395]],
      3: [[500,420,730,395],[1760,415,1980,305],[2840,375,3040,285],[4200,385,4400,285]],
      4: [[600,375,800,445],[1640,415,1830,315],[3120,275,3340,375],[3960,275,4170,385]],
      5: [[550,415,700,455],[1550,310,1750,395],[2880,360,3000,335],[4200,395,4350,430]],
    };
    for (const [x1, y1, x2, y2] of (cablesByLevel[this.currentLevel] ?? [])) {
      const cable = this.add.graphics().setDepth(3);
      cable.lineStyle(1, LIME, 0.2);
      cable.beginPath(); cable.moveTo(x1, y1 - 10); cable.lineTo(x2, y2 - 10); cable.strokePath();
    }
  }

  private buildTouchControls() {
    const W    = this.cameras.main.width;
    const H    = this.cameras.main.height;
    const btnW = 110;
    const btnH = 80;
    const pad  = 10;
    const idleAlpha  = 0.3;
    const pressAlpha = 0.55;
    const depth = 25;

    const makeBtn = (
      cx: number, cy: number, label: string,
      onDown: () => void, onUp: () => void,
    ) => {
      const bg = this.add.rectangle(cx, cy, btnW, btnH, DARK, idleAlpha)
        .setStrokeStyle(2, LIME, 0.5)
        .setScrollFactor(0).setDepth(depth)
        .setInteractive();
      this.add.text(cx, cy, label, {
        fontFamily: 'Inter, sans-serif', fontSize: '28px', color: '#bffd11',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);
      bg.on('pointerdown',  () => { bg.setAlpha(pressAlpha); onDown(); });
      bg.on('pointerup',    () => { bg.setAlpha(idleAlpha);  onUp();   });
      bg.on('pointerout',   () => { bg.setAlpha(idleAlpha);  onUp();   });
    };

    const baseY = H - btnH / 2 - pad;
    // Left
    makeBtn(btnW / 2 + pad, baseY, '◀',
      () => { this.touchLeft = true;  },
      () => { this.touchLeft = false; },
    );
    // Right
    makeBtn(btnW * 1.5 + pad * 2, baseY, '▶',
      () => { this.touchRight = true;  },
      () => { this.touchRight = false; },
    );
    // Jump
    makeBtn(W - btnW / 2 - pad, baseY, '▲',
      () => { this.touchJumpTriggered = true; },
      () => {},
    );
  }

  private buildUI() {
    this.scoreText = this.add.text(18, 16, `Data Uploaded: ${this.score} MB`, {
      fontFamily: 'Inter, sans-serif', fontSize: '22px', fontStyle: '600',
      color: '#ffffff', stroke: '#0f172a', strokeThickness: 3,
    }).setScrollFactor(0).setDepth(20);

    // Level indicator
    this.add.text(this.cameras.main.width - 18, 16, `LEVEL ${this.currentLevel + 1}: ${this.lvl.name}`, {
      fontFamily: 'Inter, sans-serif', fontSize: '14px', fontStyle: '600',
      color: '#64748b', stroke: '#0f172a', strokeThickness: 2,
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(20);

    this.add.text(18, 50, 'SIGNAL', {
      fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#64748b',
    }).setScrollFactor(0).setDepth(20);

    this.signalBarGfx = this.add.graphics().setScrollFactor(0).setDepth(20);
    this.refreshSignalBarsUI();

    this.roamingBarLabel = this.add.text(18, 100, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#bffd11',
    }).setScrollFactor(0).setDepth(20);

    this.roamingBarGfx = this.add.graphics().setScrollFactor(0).setDepth(20);

    // Progress bar — thin strip at top of screen
    const PW = this.cameras.main.width;
    this.add.rectangle(PW / 2, 2, PW, 4, 0x1e293b).setScrollFactor(0).setDepth(20);
    this.progressBarGfx = this.add.graphics().setScrollFactor(0).setDepth(21);

    // Mute toggle button (top-right, below level label)
    const muteBtn = this.add.text(this.cameras.main.width - 18, 44,
      MuteService.isMuted() ? '🔇' : '🔊', {
        fontFamily: 'Inter, sans-serif', fontSize: '20px',
      }).setOrigin(1, 0).setScrollFactor(0).setDepth(20)
        .setInteractive({ useHandCursor: true });
    muteBtn.on('pointerdown', () => {
      const muted = MuteService.toggle();
      muteBtn.setText(muted ? '🔇' : '🔊');
      this.sound.mute = muted;
    });

    const hint = this.add.text(18, this.cameras.main.height - 20, '← → / A D  move    ↑ / W / Space  jump (double jump!)    ESC  pause', {
      fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#475569',
    }).setScrollFactor(0).setDepth(20);
    this.time.delayedCall(5000, () => {
      this.tweens.add({ targets: hint, alpha: 0, duration: 1000 });
    });
  }

  private refreshSignalBarsUI() {
    this.signalBarGfx.clear();
    const BAR_WIDTHS  = [10, 10, 10, 10, 10];
    const BAR_HEIGHTS = [8, 12, 17, 22, 27];
    const GAP = 4;
    const baseY = 88;
    for (let i = 0; i < this.maxBars; i++) {
      const h  = BAR_HEIGHTS[i];
      const bx = 18 + i * (BAR_WIDTHS[i] + GAP);
      const by = baseY - h;
      this.signalBarGfx.fillStyle(i < this.signalBars ? LIME : 0x334155);
      this.signalBarGfx.fillRoundedRect(bx, by, BAR_WIDTHS[i], h, 2);
    }
  }

  private refreshProgressBar() {
    const frac = Math.min(1, this.player.x / (this.lvl.towerX + 45));
    const W = this.cameras.main.width;
    this.progressBarGfx.clear();
    this.progressBarGfx.fillStyle(LIME, 0.7);
    this.progressBarGfx.fillRect(0, 0, Math.round(W * frac), 4);
  }

  private refreshRoamingUI(frac: number) {
    this.roamingBarGfx.clear();
    if (!this.roaming) return;
    const W = 120, H = 8;
    const x = 18, y = 104;
    this.roamingBarGfx.fillStyle(DARK);
    this.roamingBarGfx.fillRoundedRect(x, y, W, H, 3);
    this.roamingBarGfx.fillStyle(LIME);
    this.roamingBarGfx.fillRoundedRect(x, y, Math.round(W * frac), H, 3);
  }

  private setupInput() {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyA    = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD    = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyW    = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyEsc  = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.keyEsc.on('down', () => {
      if (!this.gameOver && !this.victory) this.togglePause();
    });
  }

  private togglePause() {
    this.gamePaused = !this.gamePaused;
    if (this.gamePaused) {
      this.physics.world.pause();
      this.tweens.pauseAll();
      const cx = this.cameras.main.width  / 2;
      const cy = this.cameras.main.height / 2;
      const bg  = this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, NAVY, 0.82).setOrigin(0);
      const ttl = this.add.text(cx, cy - 40, 'PAUSED', {
        fontFamily: 'Inter, sans-serif', fontSize: '52px', fontStyle: '700',
        color: '#bffd11', stroke: '#0f172a', strokeThickness: 5,
      }).setOrigin(0.5);
      const sub = this.add.text(cx, cy + 24, 'ESC  →  resume     M  →  main menu', {
        fontFamily: 'Inter, sans-serif', fontSize: '16px', color: '#94a3b8',
      }).setOrigin(0.5);
      this.pauseOverlay = this.add.container(0, 0, [bg, ttl, sub]).setScrollFactor(0).setDepth(30);
      this.input.keyboard!.once('keydown-M', () => this.scene.start('MenuScene'));
    } else {
      this.physics.world.resume();
      this.tweens.resumeAll();
      this.pauseOverlay?.destroy();
      this.pauseOverlay = null;
    }
  }

  private setupCollisions() {
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.latencyBugs, this.platforms);
    this.physics.add.overlap(this.player, this.dataPackets,
      this.onCollectPacket as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);
    this.physics.add.overlap(this.player, this.latencyBugs,
      this.onHitBug as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);
    this.physics.add.overlap(this.player, this.checkpoints,
      this.onCheckpoint as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);
    this.physics.add.overlap(this.player, this.globalSims,
      this.onGlobalSim as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);
    this.physics.add.overlap(this.player, this.cellTower,
      this.onCellTower as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);
    this.physics.add.overlap(this.player, this.outageShields,
      this.onOutageShield as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);
    if (this.speedBoostPads) {
      this.physics.add.overlap(this.player, this.speedBoostPads,
        this.onSpeedBoost as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);
    }
    // Boss collisions wired after boss is built (level 5 only)
    this.events.once('boss-ready', () => {
      if (this.boss) {
        this.physics.add.overlap(this.player, this.boss,
          this.onStompBoss as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);
      }
      if (this.bossProjs) {
        this.physics.add.overlap(this.player, this.bossProjs,
          this.onBossProjectileHit as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);
        this.physics.add.collider(this.bossProjs, this.platforms, (_proj) => {
          (_proj as Phaser.Physics.Arcade.Sprite).destroy();
        });
      }
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Update helpers
  // ────────────────────────────────────────────────────────────────────────────

  private handleMovement(delta: number) {
    const body     = this.player.body as Phaser.Physics.Arcade.Body;
    const onGround = body.blocked.down;
    const velX     = body.velocity.x;
    const velY     = body.velocity.y;

    // ── Animation state machine ──────────────────────────────────────────────
    this.updatePlayerAnimation(onGround, velX, velY);

    // ── Coyote time ───────────────────────────────────────────────────────────
    if (onGround) {
      this.coyoteTimer = COYOTE_TIME;
      this.jumpCount   = 0;
    } else {
      if (this.coyoteTimer > 0) {
        this.coyoteTimer -= delta;
        if (this.coyoteTimer <= 0 && this.jumpCount === 0) this.jumpCount = 1;
      }
    }

    // ── Squash & Stretch + Jump Buffer on landing ─────────────────────────────
    if (onGround && !this.wasOnGround) {
      if (this.jumpBufferTimer > 0) {
        this.player.setVelocityY(JUMP_VEL);
        this.jumpCount      = 1;
        this.jumpBufferTimer = 0;
        this.coyoteTimer    = 0;
      } else {
        // Landing squash + dust burst
        if (!this.player.getData('squashing')) {
          this.player.setData('squashing', true);
          this.player.setScale(1.2, 0.82);
          this.tweens.add({
            targets: this.player, scaleX: 1, scaleY: 1,
            duration: 140, ease: 'Power2.easeOut',
            onComplete: () => { this.player.setData('squashing', false); },
            onStop:     () => { this.player.setData('squashing', false); },
          });
          this.landDustEmitter.explode(8, this.player.x, this.player.y + 28);
        }
      }
    }
    this.wasOnGround = onGround;

    // In-air stretch (skip during squash animation)
    if (!onGround && !this.player.getData('squashing')) {
      if (velY < -100) {
        this.player.setScale(0.86, 1.22);
      } else if (velY > 100) {
        this.player.setScale(1.1, 0.92);
      } else {
        this.player.setScale(1, 1);
      }
    } else if (onGround && !this.player.getData('squashing')) {
      this.player.setScale(1, 1);
    }

    // ── Tick jump buffer ──────────────────────────────────────────────────────
    if (this.jumpBufferTimer > 0) this.jumpBufferTimer -= delta;

    // ── Horizontal ───────────────────────────────────────────────────────────
    const speed = this.roaming ? this.upgSpeed * 1.5 : this.upgSpeed;
    if (this.cursors.left.isDown || this.keyA.isDown || this.touchLeft) {
      this.player.setVelocityX(-speed);
      this.player.setFlipX(false);
    } else if (this.cursors.right.isDown || this.keyD.isDown || this.touchRight) {
      this.player.setVelocityX(speed);
      this.player.setFlipX(true);
    }

    // ── Jump ─────────────────────────────────────────────────────────────────
    const jumpJust =
      Phaser.Input.Keyboard.JustDown(this.cursors.up)    ||
      Phaser.Input.Keyboard.JustDown(this.cursors.space) ||
      Phaser.Input.Keyboard.JustDown(this.keyW)           ||
      this.touchJumpTriggered;
    this.touchJumpTriggered = false;

    if (jumpJust) {
      const canFirst = onGround || (this.coyoteTimer > 0 && this.jumpCount < 1);
      if (canFirst) {
        this.killSquashTween();
        this.player.setVelocityY(JUMP_VEL);
        this.jumpCount      = 1;
        this.coyoteTimer    = 0;
        this.jumpBufferTimer = 0;
        this.player.setScale(0.82, 1.3);
      } else if (this.jumpCount === 1) {
        this.killSquashTween();
        this.player.setVelocityY(JUMP_VEL2);
        this.jumpCount = 2;
        this.player.setScale(0.88, 1.18);
      } else {
        this.jumpBufferTimer = JUMP_BUFFER;
      }
    }
  }

  private killSquashTween() {
    this.tweens.killTweensOf(this.player);
    this.player.setData('squashing', false);
    this.player.setRotation(0);
  }

  private patrolBugs() {
    for (const child of this.latencyBugs.getChildren()) {
      const bug   = child as Phaser.Physics.Arcade.Sprite;
      const start = bug.getData('startX') as number;
      const range = bug.getData('range')  as number;
      if (bug.x >= start + range)      { bug.setVelocityX(-this.lvl.bugSpeed); bug.setFlipX(true);  }
      else if (bug.x <= start - range) { bug.setVelocityX( this.lvl.bugSpeed); bug.setFlipX(false); }
    }
  }

  private tickRoaming(delta: number) {
    if (!this.roaming) return;
    this.roamingTimer -= delta;
    const frac = Math.max(0, this.roamingTimer / 10000);
    this.refreshRoamingUI(frac);
    this.roamingBarLabel.setText(`⚡ GLOBAL ROAMING  ${Math.ceil(this.roamingTimer / 1000)}s`);
    if (this.roamingTimer <= 0) this.endRoaming();
  }

  private tickShield(delta: number) {
    if (!this.shieldActive) return;
    this.shieldTimer -= delta;
    // Update glow position to follow player
    if (this.shieldGlow) {
      this.shieldGlow.clear();
      this.shieldGlow.lineStyle(2, 0x22d3ee, 0.5 + 0.3 * Math.sin(Date.now() / 200));
      this.shieldGlow.strokeCircle(this.player.x, this.player.y, 34);
      this.shieldGlow.lineStyle(1, 0x22d3ee, 0.2);
      this.shieldGlow.strokeCircle(this.player.x, this.player.y, 42);
    }
    if (this.shieldTimer <= 0) {
      this.shieldActive = false;
      this.invincible = false;
      this.player.setAlpha(1);
      if (this.shieldGlow) { this.shieldGlow.destroy(); this.shieldGlow = null; }
    }
  }

  private maybeApplyMagnet() {
    if (!this.upgradePacketMagnet) return;
    const px = this.player.x, py = this.player.y;
    for (const child of this.dataPackets.getChildren()) {
      const p = child as Phaser.Physics.Arcade.Image;
      if (!p.active) continue;
      const dist = Phaser.Math.Distance.Between(p.x, p.y, px, py);
      if (dist < 160 && dist > 2) {
        const angle = Phaser.Math.Angle.Between(p.x, p.y, px, py);
        p.x += Math.cos(angle) * 4;
        p.y += Math.sin(angle) * 4;
        (p.body as Phaser.Physics.Arcade.StaticBody).reset(p.x, p.y);
      }
    }
  }

  private checkPitDeath() {
    if (this.player.y > WORLD_HEIGHT + 80) this.triggerDeath();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Signal / Roaming / Damage
  // ────────────────────────────────────────────────────────────────────────────

  private takeDamage(instant = false) {
    if (this.gameOver || this.invincible || this.roaming) return;
    this.signalBars = Math.max(0, this.signalBars - 1);
    this.refreshSignalBarsUI();

    if (this.signalBars <= 0 || instant) {
      this.triggerDeath();
      return;
    }

    // Damage flash invincibility (1.5 s)
    this.invincible = true;
    const flashTween = this.tweens.add({
      targets: this.player, alpha: 0,
      duration: 90, yoyo: true, repeat: 8,
      onComplete: () => { this.player.setAlpha(1); this.invincible = false; },
      onStop:     () => { this.player.setAlpha(1); this.invincible = false; },
    });
    // Screen shake
    this.cameras.main.shake(180, 0.008);
    void flashTween;
  }

  private startRoaming() {
    if (this.roaming) {
      this.roamingTimer = 10000; // extend
      return;
    }
    this.roaming      = true;
    this.roamingTimer = 10000;
    this.invincible   = true;

    this.player.setTint(LIME);
    this.roamingFlashTween = this.tweens.add({
      targets: this.player, alpha: 0.35,
      duration: 110, yoyo: true, repeat: -1,
    });
    this.roamingParticles.start();
    this.roamingBarLabel.setText('⚡ GLOBAL ROAMING  10s');
    this.refreshRoamingUI(1);
  }

  private endRoaming() {
    this.roaming = false;
    this.invincible = false;
    this.roamingFlashTween?.stop();
    this.roamingFlashTween = null;
    this.player.clearTint();
    this.player.setAlpha(1);
    this.roamingParticles.stop();
    this.roamingBarLabel.setText('');
    this.roamingBarGfx.clear();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Overlap callbacks
  // ────────────────────────────────────────────────────────────────────────────

  private onCollectPacket(
    _p: Phaser.GameObjects.GameObject,
    packetObj: Phaser.GameObjects.GameObject,
  ) {
    const packet = packetObj as Phaser.Physics.Arcade.Image;
    const wx = packet.x, wy = packet.y;
    packet.disableBody(true, true);

    this.score += 10;
    this.scoreText.setText(`Data Uploaded: ${this.score} MB`);

    const burst = this.add.graphics().setDepth(9);
    burst.fillStyle(LIME, 0.9);
    burst.fillRect(-8, -8, 16, 16);
    burst.x = wx; burst.y = wy;
    this.tweens.add({
      targets: burst, scaleX: 2.8, scaleY: 2.8, alpha: 0,
      duration: 280, ease: 'Power2',
      onComplete: () => burst.destroy(),
    });
    const lbl = this.add.text(wx, wy - 10, '+10 MB', {
      fontFamily: 'Inter, sans-serif', fontSize: '13px', fontStyle: '700',
      color: '#bffd11', stroke: '#0f172a', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10);
    this.tweens.add({
      targets: lbl, y: wy - 50, alpha: 0, duration: 650, ease: 'Power2',
      onComplete: () => lbl.destroy(),
    });
  }

  private onHitBug(
    playerObj: Phaser.GameObjects.GameObject,
    bugObj: Phaser.GameObjects.GameObject,
  ) {
    if (this.gameOver || this.victory) return;
    const p    = playerObj as Phaser.Physics.Arcade.Sprite;
    const bug  = bugObj    as Phaser.Physics.Arcade.Sprite;
    const body = p.body    as Phaser.Physics.Arcade.Body;

    if (body.velocity.y > 60 && p.y < bug.y - 2) {
      // ─ Stomp ─
      bug.disableBody(true, true);
      this.killSquashTween();
      p.setVelocityY(-430);
      p.setScale(1.4, 0.68);
      this.tweens.add({
        targets: p, scaleX: 1, scaleY: 1, duration: 120, ease: 'Back.easeOut',
      });
      this.jumpCount = 1;
      this.score += 50;
      this.scoreText.setText(`Data Uploaded: ${this.score} MB`);
      const lbl = this.add.text(bug.x, bug.y - 10, '+50 MB  STOMP!', {
        fontFamily: 'Inter, sans-serif', fontSize: '15px', fontStyle: '700',
        color: '#bffd11', stroke: '#0f172a', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(10);
      this.tweens.add({
        targets: lbl, y: bug.y - 65, alpha: 0, duration: 800, ease: 'Power2',
        onComplete: () => lbl.destroy(),
      });
    } else {
      this.takeDamage();
    }
  }

  private onCheckpoint(
    _p: Phaser.GameObjects.GameObject,
    cpObj: Phaser.GameObjects.GameObject,
  ) {
    const cp = cpObj as Phaser.Physics.Arcade.Image;
    if (cp.getData('activated')) return;
    cp.setData('activated', true);
    // Swap to active beacon texture
    cp.setTexture('checkpoint_active');
    // Alpha pulse tween on activated checkpoint
    this.tweens.add({
      targets: cp, alpha: { from: 1, to: 0.7 },
      duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    this.signalBars = this.maxBars;
    this.refreshSignalBarsUI();
    this.cameras.main.flash(300, 191, 253, 17, false);

    const msg = this.add.text(cp.x, cp.y - 70, '✦ SIGNAL RESTORED ✦', {
      fontFamily: 'Inter, sans-serif', fontSize: '18px', fontStyle: '700',
      color: '#bffd11', stroke: '#0f172a', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(15);
    this.tweens.add({
      targets: msg, y: msg.y - 45, alpha: 0, duration: 1200, ease: 'Power2',
      onComplete: () => msg.destroy(),
    });
  }

  private onGlobalSim(
    _p: Phaser.GameObjects.GameObject,
    simObj: Phaser.GameObjects.GameObject,
  ) {
    const sim = simObj as Phaser.Physics.Arcade.Image;
    sim.disableBody(true, true);

    this.startRoaming();
    this.cameras.main.flash(250, 191, 253, 17, false);

    const msg = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 - 100,
      '⚡ GLOBAL ROAMING ACTIVE! ⚡',
      {
        fontFamily: 'Inter, sans-serif', fontSize: '28px', fontStyle: '700',
        color: '#bffd11', stroke: '#0f172a', strokeThickness: 4,
      },
    ).setOrigin(0.5).setScrollFactor(0).setDepth(22);
    this.tweens.add({
      targets: msg, y: msg.y - 30, alpha: 0, duration: 1800, ease: 'Power2',
      onComplete: () => msg.destroy(),
    });
  }

  private onOutageShield(
    _p: Phaser.GameObjects.GameObject,
    shieldObj: Phaser.GameObjects.GameObject,
  ) {
    const shield = shieldObj as Phaser.Physics.Arcade.Image;
    shield.disableBody(true, true);

    // Activate 10-second invincibility
    this.shieldActive = true;
    this.shieldTimer  = 10000;
    this.invincible   = true;

    // Visual: cyan glow around Simmie
    if (this.shieldGlow) this.shieldGlow.destroy();
    this.shieldGlow = this.add.graphics().setDepth(9);

    // Subtle alpha pulse on player
    this.tweens.add({
      targets: this.player,
      alpha: { from: 1, to: 0.7 },
      duration: 300, yoyo: true, repeat: 19,
    });

    this.cameras.main.flash(200, 34, 211, 238, false);

    const shieldMsg = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 - 100,
      '🛡 OUTAGE PROTECTION — 10s! 🛡',
      {
        fontFamily: 'Inter, sans-serif', fontSize: '24px', fontStyle: '700',
        color: '#22d3ee', stroke: '#0f172a', strokeThickness: 4,
      },
    ).setOrigin(0.5).setScrollFactor(0).setDepth(22);
    this.tweens.add({
      targets: shieldMsg, y: shieldMsg.y - 40, alpha: 0, duration: 1800, ease: 'Power2',
      onComplete: () => shieldMsg.destroy(),
    });
  }

  private onSpeedBoost(
    _p: Phaser.GameObjects.GameObject,
    padObj: Phaser.GameObjects.GameObject,
  ) {
    const pad = padObj as Phaser.Physics.Arcade.Image;
    if (pad.getData('cooldown')) return;
    pad.setData('cooldown', true);
    // Brief cooldown so you don't re-trigger immediately
    this.time.delayedCall(800, () => pad.setData('cooldown', false));

    // Launch Simmie rightward at blazing speed
    this.player.setVelocityX(900);
    this.player.setFlipX(true); // facing right

    // Yellow flash
    this.cameras.main.flash(150, 255, 180, 0, false);

    // Floating boost text
    const boostTxt = this.add.text(this.player.x, this.player.y - 40, '⚡ BOOST!', {
      fontFamily: 'Inter, sans-serif', fontSize: '20px', fontStyle: '700',
      color: '#ffaa00', stroke: '#0f172a', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(15);
    this.tweens.add({
      targets: boostTxt, y: boostTxt.y - 50, alpha: 0, duration: 800, ease: 'Power2',
      onComplete: () => boostTxt.destroy(),
    });
  }

  private onCellTower(
    _p: Phaser.GameObjects.GameObject,
    towerObj: Phaser.GameObjects.GameObject,
  ) {
    if (this.victory || this.gameOver) return;
    const t = towerObj as Phaser.Physics.Arcade.Image;
    if (!t.getData('active')) return;
    t.setData('active', false);
    this.victory = true;

    if (this.roaming) this.endRoaming();
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);

    const cx = this.cameras.main.width  / 2;
    const cy = this.cameras.main.height / 2;
    this.cameras.main.flash(500, 191, 253, 17, false);

    const isLastLevel = this.currentLevel >= LEVELS.length - 1;

    if (isLastLevel) {
      // Final victory — hand off to EndGameScene
      SaveService.addPackets(this.score);
      void SaveService.submitScore('Player', this.score);

      this.time.delayedCall(800, () => {
        this.levelMusic?.stop();
        this.scene.start('EndGameScene', { score: this.score });
      });
    } else {
      // Level complete — advance
      const nextLevel = this.currentLevel + 1;
      const nextName = LEVELS[nextLevel].name;

      this.add.rectangle(cx, cy, 760, 280, NAVY, 0.93).setScrollFactor(0).setDepth(25);
      this.add.text(cx, cy - 75, `LEVEL ${this.currentLevel + 1} COMPLETE!`, {
        fontFamily: 'Inter, sans-serif', fontSize: '44px', fontStyle: '700',
        color: '#bffd11', stroke: '#0f172a', strokeThickness: 4,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(26);
      this.add.text(cx, cy - 10, `${this.score} MB uploaded so far`, {
        fontFamily: 'Inter, sans-serif', fontSize: '20px', color: '#ffffff',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(26);
      this.add.text(cx, cy + 30, `Next: LEVEL ${nextLevel + 1} — ${nextName}`, {
        fontFamily: 'Inter, sans-serif', fontSize: '18px', color: '#94a3b8',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(26);
      this.add.text(cx, cy + 80, 'SPACE  →  next level     M  →  main menu', {
        fontFamily: 'Inter, sans-serif', fontSize: '15px', color: '#64748b',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(26);

      this.input.keyboard!.once('keydown-SPACE', () => this.scene.restart({ level: nextLevel, score: this.score }));
      this.input.keyboard!.once('keydown-M',     () => this.scene.start('MenuScene'));
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Death
  // ────────────────────────────────────────────────────────────────────────────

  private triggerDeath() {
    if (this.gameOver) return;
    this.gameOver = true;
    if (this.roaming) this.endRoaming();

    this.player.setTint(0xff4444);
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.cameras.main.shake(300, 0.018);

    const cx = this.cameras.main.width  / 2;
    const cy = this.cameras.main.height / 2;

    const packetsThisRun = this.score - this.carryScore;
    this.add.rectangle(cx, cy, 640, 260, NAVY, 0.93).setScrollFactor(0).setDepth(25);
    this.add.text(cx, cy - 68, 'CONNECTION\nDROPPED!', {
      fontFamily: 'Inter, sans-serif', fontSize: '50px', fontStyle: '700',
      color: '#ff3b3b', stroke: '#0f172a', strokeThickness: 4, align: 'center',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(26);
    this.add.text(cx, cy + 18, `${packetsThisRun} MB collected  ·  ${this.score} MB total`, {
      fontFamily: 'Inter, sans-serif', fontSize: '15px', color: '#bffd11',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(26);
    this.add.text(cx, cy + 68, 'SPACE  →  retry     M  →  main menu', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px', color: '#94a3b8',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(26);

    this.input.keyboard!.once('keydown-SPACE', () => this.scene.restart({ level: this.currentLevel }));
    this.input.keyboard!.once('keydown-M',     () => this.scene.start('MenuScene'));
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Boss — Dead Zone
  // ────────────────────────────────────────────────────────────────────────────

  private buildBoss() {
    // ── Build boss texture ──
    if (!this.textures.exists('deadzone_boss')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      const W = 100, H = 90;
      // Dark corrupt body
      g.fillStyle(0x1a0a2a); g.fillRoundedRect(0, 10, W, H - 10, 12);
      // Red corrupt core glow
      g.fillStyle(0x660022, 0.9); g.fillRoundedRect(10, 18, W - 20, H - 28, 8);
      g.fillStyle(0xff003c, 0.6); g.fillRoundedRect(22, 28, W - 44, H - 44, 6);
      // Glitch scan-lines
      g.lineStyle(1, 0xff003c, 0.25);
      for (let y = 14; y < H; y += 6) { g.beginPath(); g.moveTo(4, y); g.lineTo(W - 4, y); g.strokePath(); }
      // Evil eyes
      g.fillStyle(RED); g.fillCircle(30, 32, 10); g.fillCircle(70, 32, 10);
      g.fillStyle(0xffffff); g.fillCircle(30, 32, 5); g.fillCircle(70, 32, 5);
      g.fillStyle(0x330000); g.fillCircle(32, 34, 3); g.fillCircle(72, 34, 3);
      // Jagged mouth
      g.lineStyle(2, 0xff003c, 0.9);
      g.beginPath();
      const teeth = [35,62, 42,72, 49,62, 56,72, 63,62, 65,62];
      g.moveTo(teeth[0], teeth[1]);
      for (let i = 2; i < teeth.length; i += 2) g.lineTo(teeth[i], teeth[i+1]);
      g.strokePath();
      // Spike crown
      g.fillStyle(0x660022);
      const spikes = [[15,10],[30,0],[50,10],[70,0],[85,10]];
      for (const [sx, sy] of spikes) {
        g.fillTriangle(sx - 8, 14, sx, sy, sx + 8, 14);
      }
      // Corrupt aura
      g.lineStyle(2, 0x8800ff, 0.3); g.strokeRoundedRect(2, 8, W - 4, H - 4, 10);
      g.generateTexture('deadzone_boss', W, H); g.destroy();
    }

    // ── Projectile texture ──
    if (!this.textures.exists('boss_proj')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xff003c, 0.9); g.fillCircle(8, 8, 8);
      g.fillStyle(0xffffff, 0.5); g.fillCircle(6, 6, 3);
      g.generateTexture('boss_proj', 16, 16); g.destroy();
    }

    // ── Spawn boss ──
    // Boss sits on the arena floor at x=4550, waits until player enters the arena
    this.boss = this.physics.add.sprite(4550, WORLD_HEIGHT - 64 - 45, 'deadzone_boss');
    this.boss.setCollideWorldBounds(true);
    this.boss.setDepth(7);
    this.boss.setData('active', false); // dormant until player reaches x=4100

    // Idle float tween
    this.tweens.add({
      targets: this.boss, y: this.boss.y - 20,
      duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Ominous aura pulse
    const aura = this.add.graphics().setDepth(6);
    this.tweens.add({
      targets: { v: 0 },
      v: 1,
      duration: 800, yoyo: true, repeat: -1,
      onUpdate: (tween) => {
        const v = tween.getValue() as number;
        if (!this.boss || !this.boss.active) return;
        aura.clear();
        aura.lineStyle(2, 0x8800ff, 0.15 + 0.25 * v);
        aura.strokeCircle(this.boss.x, this.boss.y, 70 + v * 20);
        aura.lineStyle(2, 0xff003c, 0.1 + 0.2 * v);
        aura.strokeCircle(this.boss.x, this.boss.y, 50 + v * 10);
      },
    });

    // ── Boss HP bar UI ──
    const bx = this.cameras.main.width / 2;
    this.bossHPLabel = this.add.text(bx, 120, '☠  DEAD ZONE', {
      fontFamily: 'Inter, sans-serif', fontSize: '14px', fontStyle: '700',
      color: '#ff003c', stroke: '#0f172a', strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(20).setAlpha(0);

    this.bossHPBarBg = this.add.graphics().setScrollFactor(0).setDepth(20);
    this.bossHPBarGfx = this.add.graphics().setScrollFactor(0).setDepth(20);

    // ── Projectile group ──
    this.bossProjs = this.physics.add.group();

    this.events.emit('boss-ready');
  }

  private activateBoss() {
    if (!this.boss || this.boss.getData('active')) return;
    this.boss.setData('active', true);

    // Slam entrance
    this.cameras.main.shake(400, 0.015);
    const cx = this.cameras.main.width / 2;
    const cy = this.cameras.main.height / 2;
    const warn = this.add.text(cx, cy - 40, '☠  DEAD ZONE AWAKENS  ☠', {
      fontFamily: 'Inter, sans-serif', fontSize: '28px', fontStyle: '700',
      color: '#ff003c', stroke: '#0f172a', strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(30);
    this.tweens.add({ targets: warn, alpha: 0, delay: 2000, duration: 600,
      onComplete: () => warn.destroy() });

    // Show HP bar
    this.bossHPLabel?.setAlpha(1);
    this.refreshBossHPBar();

    // Start firing
    const fireDelay = 2200;
    this.bossFireTimer = this.time.addEvent({
      delay: fireDelay, loop: true, callback: this.bossFireVolley, callbackScope: this,
    });
  }

  private refreshBossHPBar() {
    if (!this.bossHPBarGfx || !this.bossHPBarBg) return;
    const bx = this.cameras.main.width / 2;
    const barW = 300, barH = 12, barY = 134;
    this.bossHPBarBg.clear();
    this.bossHPBarBg.fillStyle(0x1e293b);
    this.bossHPBarBg.fillRoundedRect(bx - barW / 2, barY, barW, barH, 4);
    this.bossHPBarGfx.clear();
    const frac = Math.max(0, this.bossHP / this.bossMaxHP);
    const col  = frac > 0.5 ? 0xff003c : frac > 0.25 ? 0xff6600 : 0xffff00;
    this.bossHPBarGfx.fillStyle(col);
    this.bossHPBarGfx.fillRoundedRect(bx - barW / 2, barY, Math.round(barW * frac), barH, 4);
  }

  private bossFireVolley() {
    if (!this.boss || !this.boss.active || !this.bossProjs || this.bossDefeated) return;

    // Phase determines shot count and speed
    const shots = this.bossPhase === 0 ? 2 : this.bossPhase === 1 ? 3 : 5;
    const speed = this.bossPhase === 0 ? 260 : this.bossPhase === 1 ? 340 : 420;

    for (let i = 0; i < shots; i++) {
      const angle = Phaser.Math.Angle.Between(
        this.boss.x, this.boss.y,
        this.player.x + Phaser.Math.Between(-60, 60),
        this.player.y + Phaser.Math.Between(-30, 30),
      );
      const delay = i * 180;
      this.time.delayedCall(delay, () => {
        if (!this.boss || !this.bossProjs || this.bossDefeated) return;
        const proj = this.bossProjs.create(this.boss.x, this.boss.y, 'boss_proj') as Phaser.Physics.Arcade.Sprite;
        proj.setDepth(7);
        this.physics.velocityFromRotation(angle, speed, proj.body!.velocity as Phaser.Math.Vector2);
        (proj.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
        // Auto-destroy after 4 s
        this.time.delayedCall(4000, () => { if (proj.active) proj.destroy(); });
      });
    }

    // Boss pace-walks toward player
    if (this.boss.active) {
      const dir = this.player.x < this.boss.x ? -1 : 1;
      const pace = 60 + this.bossPhase * 30;
      this.boss.setVelocityX(dir * pace);
      this.time.delayedCall(800, () => { if (this.boss?.active) this.boss.setVelocityX(0); });
    }
  }

  private tickBoss() {
    if (!this.boss || !this.boss.getData('active') || this.bossDefeated) return;

    // Activate when player enters the arena
    if (!this.boss.getData('active') && this.player.x > 4100) {
      this.activateBoss();
    }

    // Update phase
    const newPhase = this.bossHP <= 1 ? 2 : this.bossHP <= 3 ? 1 : 0;
    if (newPhase !== this.bossPhase) {
      this.bossPhase = newPhase;
      // Faster fire rate on phase change
      this.bossFireTimer?.remove();
      const delay = newPhase === 1 ? 1600 : 1100;
      this.bossFireTimer = this.time.addEvent({
        delay, loop: true, callback: this.bossFireVolley, callbackScope: this,
      });
      // Flash boss red on phase change
      this.boss.setTint(0xff0000);
      this.time.delayedCall(400, () => { this.boss?.clearTint(); });
      this.cameras.main.shake(250, 0.012);
    }
  }

  private onStompBoss(
    playerObj: Phaser.GameObjects.GameObject,
    _bossObj:  Phaser.GameObjects.GameObject,
  ) {
    if (this.gameOver || this.victory || this.bossDefeated) return;
    if (!this.boss?.getData('active')) {
      // Player reached arena — activate boss
      this.activateBoss();
      return;
    }

    const p    = playerObj as Phaser.Physics.Arcade.Sprite;
    const body = p.body as Phaser.Physics.Arcade.Body;

    if (body.velocity.y > 60 && p.y < this.boss.y - 10) {
      // Stomp hit
      p.setVelocityY(-480);
      this.bossHP -= 1;
      this.refreshBossHPBar();
      this.cameras.main.shake(200, 0.01);

      // Visual hit feedback
      this.boss.setTint(0xffffff);
      this.time.delayedCall(120, () => { this.boss?.clearTint(); });

      const hitTxt = this.add.text(this.boss.x, this.boss.y - 60,
        `-1 ⚡ ${this.bossHP} HP left`, {
          fontFamily: 'Inter, sans-serif', fontSize: '14px', fontStyle: '700',
          color: '#bffd11', stroke: '#0f172a', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(30);
      this.tweens.add({ targets: hitTxt, y: hitTxt.y - 40, alpha: 0, duration: 900,
        onComplete: () => hitTxt.destroy() });

      if (this.bossHP <= 0) {
        this.defeatBoss();
      }
    } else {
      // Side/bottom collision — take damage
      this.takeDamage();
    }
  }

  private onBossProjectileHit(
    _playerObj: Phaser.GameObjects.GameObject,
    projObj:    Phaser.GameObjects.GameObject,
  ) {
    (projObj as Phaser.Physics.Arcade.Sprite).destroy();
    this.takeDamage();
  }

  private defeatBoss() {
    if (this.bossDefeated) return;
    this.bossDefeated = true;
    this.bossFireTimer?.remove();

    // Explosion sequence
    this.cameras.main.shake(500, 0.025);
    this.cameras.main.flash(300, 255, 0, 60, false);

    for (let i = 0; i < 16; i++) {
      this.time.delayedCall(i * 80, () => {
        if (!this.boss) return;
        const burst = this.add.graphics().setDepth(30);
        burst.fillStyle(i % 2 === 0 ? 0xff003c : 0xffaa00);
        burst.fillCircle(
          this.boss.x + Phaser.Math.Between(-50, 50),
          this.boss.y + Phaser.Math.Between(-40, 40),
          Phaser.Math.Between(8, 22),
        );
        this.tweens.add({ targets: burst, alpha: 0, scale: 2.5, duration: 400,
          onComplete: () => burst.destroy() });
      });
    }

    // Boss disappears after explosions
    this.time.delayedCall(1300, () => {
      this.boss?.destroy();
      this.bossHPBarGfx?.clear();
      this.bossHPBarBg?.clear();

      const cx = this.cameras.main.width / 2;
      const cy = this.cameras.main.height / 2;
      const msg = this.add.text(cx, cy - 30, '☠  DEAD ZONE DEFEATED!  ☠', {
        fontFamily: 'Inter, sans-serif', fontSize: '30px', fontStyle: '700',
        color: '#bffd11', stroke: '#0f172a', strokeThickness: 4,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(30);
      const sub = this.add.text(cx, cy + 18, 'Reach the cell tower to complete your mission!', {
        fontFamily: 'Inter, sans-serif', fontSize: '15px', color: '#94a3b8',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(30);
      this.tweens.add({ targets: [msg, sub], alpha: 0, delay: 3000, duration: 800,
        onComplete: () => { msg.destroy(); sub.destroy(); } });

      // Enable cell tower
      this.cellTower.getChildren().forEach(t => (t as Phaser.Physics.Arcade.Image).setData('active', true));
    });
  }
}
