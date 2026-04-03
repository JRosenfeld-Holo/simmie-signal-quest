import Phaser from 'phaser';

const LIME  = 0xbffd11;
const NAVY  = 0x0f172a;
const DARK  = 0x1e293b;
const WHITE = 0xffffff;

export default class EndGameScene extends Phaser.Scene {
  private endMusic: Phaser.Sound.BaseSound | null = null;

  constructor() { super({ key: 'EndGameScene' }); }

  init() {
    this.sound.stopAll();
  }

  preload() {
    this.load.svg('simmie_end', '/assets/Simmie.svg', { width: 180, height: 158 });
    this.load.svg('hologram_logo_end', '/assets/hologram_logo_white.svg', { width: 180, height: 48 });
    if (!this.cache.audio.has('music_end')) {
      this.load.audio('music_end', '/assets/music/End Game Scene.mp3');
    }
  }

  create(data?: { score?: number }) {
    const W  = this.cameras.main.width;
    const H  = this.cameras.main.height;
    const cx = W / 2;
    const cy = H / 2;
    const score = data?.score ?? 0;

    // ── Music ────────────────────────────────────────────────────────────────
    this.endMusic = this.sound.add('music_end', { loop: true, volume: 0.55 });
    this.endMusic.play();
    this.events.on('shutdown', () => { this.endMusic?.stop(); });

    // ── Background ───────────────────────────────────────────────────────────
    this.add.rectangle(cx, cy, W, H, NAVY);

    // Radial glow burst behind simmie
    const glow = this.add.graphics();
    for (let r = 260; r > 0; r -= 20) {
      glow.fillStyle(LIME, 0.012);
      glow.fillCircle(cx, cy - 80, r);
    }

    // Animated grid
    const g = this.add.graphics();
    g.lineStyle(1, 0x1e293b, 0.4);
    for (let x = 0; x <= W; x += 80)  { g.moveTo(x, 0); g.lineTo(x, H); }
    for (let y = 0; y <= H; y += 80)  { g.moveTo(0, y); g.lineTo(W, y); }
    g.strokePath();

    // ── Confetti particles ───────────────────────────────────────────────────
    const confettiColors = [LIME, 0xff3b3b, 0x22d3ee, 0xfbbf24, 0xa855f7, WHITE];
    for (let i = 0; i < 120; i++) {
      const col = confettiColors[i % confettiColors.length];
      const sz  = Phaser.Math.Between(4, 10);
      const dot = this.add.rectangle(
        Phaser.Math.Between(0, W), Phaser.Math.Between(-60, H),
        sz, sz * 0.5, col,
      ).setAlpha(0.8);
      const spawnConfetti = () => {
        dot.x = Phaser.Math.Between(0, W);
        dot.y = Phaser.Math.Between(-60, -10);
        dot.setAlpha(0.8);
        this.tweens.add({
          targets: dot,
          y:       dot.y + Phaser.Math.Between(H + 100, H + 300),
          x:       dot.x + Phaser.Math.Between(-80, 80),
          angle:   Phaser.Math.Between(-360, 360),
          alpha:   0,
          duration: Phaser.Math.Between(2000, 5000),
          delay:    Phaser.Math.Between(0, 3000),
          ease:     'Linear',
          onComplete: spawnConfetti,
        });
      };
      spawnConfetti();
    }

    // ── Simmie ───────────────────────────────────────────────────────────────
    const simmie = this.add.image(cx, cy - 120, 'simmie_end').setDepth(5);
    this.tweens.add({
      targets: simmie,
      y:       simmie.y - 18,
      duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    // Spinning lime halo ring
    const halo = this.add.graphics().setDepth(4);
    halo.lineStyle(3, LIME, 0.5);
    halo.strokeEllipse(cx, cy - 120, 200, 30);
    this.tweens.add({ targets: halo, angle: 360, duration: 3000, repeat: -1, ease: 'Linear' });

    // ── Title ────────────────────────────────────────────────────────────────
    const titleText = this.add.text(cx, cy + 20, 'MISSION', {
      fontFamily: 'Inter, sans-serif', fontSize: '72px', fontStyle: '900',
      color: '#bffd11', stroke: '#0f172a', strokeThickness: 6,
    }).setOrigin(0.5).setAlpha(0).setDepth(5);

    const subText = this.add.text(cx, cy + 96, 'COMPLETE', {
      fontFamily: 'Inter, sans-serif', fontSize: '48px', fontStyle: '700',
      color: '#ffffff', stroke: '#0f172a', strokeThickness: 4,
    }).setOrigin(0.5).setAlpha(0).setDepth(5);

    // Animate title in
    this.tweens.add({ targets: titleText, alpha: 1, y: cy + 8, duration: 700, delay: 300, ease: 'Back.easeOut' });
    this.tweens.add({ targets: subText,  alpha: 1, y: cy + 88, duration: 700, delay: 600, ease: 'Back.easeOut' });

    // Pulsing lime outline under title
    const underline = this.add.rectangle(cx, cy + 128, 0, 3, LIME).setDepth(5);
    this.tweens.add({ targets: underline, width: 420, duration: 600, delay: 900, ease: 'Power2' });

    // ── Stats ────────────────────────────────────────────────────────────────
    const statsBg = this.add.rectangle(cx, cy + 185, 480, 56, DARK, 0.85)
      .setStrokeStyle(1, LIME, 0.4).setDepth(5).setAlpha(0);
    const statsText = this.add.text(cx, cy + 185,
      `⚡  ${score} MB uploaded to the cloud`, {
        fontFamily: 'Inter, sans-serif', fontSize: '18px', fontStyle: '600',
        color: '#bffd11',
      }).setOrigin(0.5).setAlpha(0).setDepth(6);
    this.tweens.add({ targets: [statsBg, statsText], alpha: 1, duration: 500, delay: 1200 });

    // ── Flavor text ──────────────────────────────────────────────────────────
    this.add.text(cx, cy + 232, 'Simmie defeated the Dead Zone and restored the signal.', {
      fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#64748b',
    }).setOrigin(0.5).setDepth(5);

    // ── Buttons ──────────────────────────────────────────────────────────────
    this.time.delayedCall(1600, () => {
      this.makeButton(cx - 190, H - 58, '▶  LEVEL 1', () => {
        this.endMusic?.stop();
        this.scene.start('GameScene', { level: 0 });
      });
      this.makeButton(cx, H - 58, '⚔  BOSS FIGHT', () => {
        this.endMusic?.stop();
        this.scene.start('GameScene', { level: 4 });
      });
      this.makeButton(cx + 190, H - 58, '⌂  MAIN MENU', () => {
        this.endMusic?.stop();
        this.scene.start('MenuScene');
      });
    });

    // ── Hologram logo ────────────────────────────────────────────────────────
    this.add.image(16, 16, 'hologram_logo_end').setOrigin(0, 0).setAlpha(0.6).setDepth(5);

    // ── Stars burst on entry ─────────────────────────────────────────────────
    this.time.delayedCall(200, () => {
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const dist  = Phaser.Math.Between(80, 180);
        const star  = this.add.text(
          cx + Math.cos(angle) * 20,
          cy - 120 + Math.sin(angle) * 20,
          '★', { fontSize: '18px', color: '#bffd11' },
        ).setOrigin(0.5).setDepth(6);
        this.tweens.add({
          targets: star,
          x: cx + Math.cos(angle) * dist,
          y: cy - 120 + Math.sin(angle) * dist,
          alpha: { from: 1, to: 0 },
          scale: { from: 1.4, to: 0 },
          duration: 700,
          delay: i * 50,
          ease: 'Power2',
        });
      }
    });
  }

  private makeButton(x: number, y: number, label: string, cb: () => void) {
    const bg = this.add.rectangle(x, y, 220, 50, DARK)
      .setStrokeStyle(2, LIME).setInteractive({ useHandCursor: true }).setDepth(5);
    const txt = this.add.text(x, y, label, {
      fontFamily: 'Inter, sans-serif', fontSize: '18px', fontStyle: '600',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(6);
    bg.on('pointerover', () => { bg.setFillStyle(0x2d3f55); txt.setColor('#bffd11'); });
    bg.on('pointerout',  () => { bg.setFillStyle(DARK);     txt.setColor('#ffffff'); });
    bg.on('pointerdown', () => {
      this.tweens.add({ targets: bg, scaleX: 0.96, scaleY: 0.96, duration: 60, yoyo: true });
      this.time.delayedCall(80, cb);
    });
  }
}
