import Phaser from 'phaser';
import { SaveService } from '../services/SaveService';
import { MuteService } from '../services/MuteService';

const LIME = 0xbffd11;
const NAVY = 0x0f172a;
const DARK = 0x1e293b;

export default class MenuScene extends Phaser.Scene {
  constructor() { super({ key: 'MenuScene' }); }

  preload() {
    this.load.svg('simmie_menu',   '/assets/Simmie.svg',              { width: 160, height: 140 });
    this.load.svg('hologram_logo', '/assets/hologram_logo_white.svg', { width: 200, height: 53  });
    if (!this.cache.audio.has('music_menu')) {
      this.load.audio('music_menu', '/assets/music/menu_theme.mp3');
    }
  }

  create() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    // ── Menu music ────────────────────────────────────────────────────────────
    this.sound.stopAll();
    const menuMusic = this.sound.add('music_menu', { loop: true, volume: 0.45 });
    menuMusic.play();
    this.events.on('shutdown', () => menuMusic.stop());

    // ── Background ────────────────────────────────────────────────────────────
    this.add.rectangle(W / 2, H / 2, W, H, NAVY);
    const g = this.add.graphics();
    g.lineStyle(1, 0x1e293b, 0.5);
    for (let x = 0; x <= W; x += 80)  { g.moveTo(x, 0); g.lineTo(x, H); }
    for (let y = 0; y <= H; y += 80)  { g.moveTo(0, y); g.lineTo(W, y); }
    g.strokePath();

    // Animated particle dots
    for (let i = 0; i < 60; i++) {
      const dot = this.add.graphics();
      const x  = Phaser.Math.Between(0, W);
      const y  = Phaser.Math.Between(0, H);
      dot.fillStyle(LIME, Phaser.Math.FloatBetween(0.08, 0.35));
      dot.fillCircle(x, y, Phaser.Math.Between(1, 3));
      this.tweens.add({
        targets: dot,
        alpha:   { from: Phaser.Math.FloatBetween(0.1, 0.4), to: 0 },
        duration: Phaser.Math.Between(1500, 4000),
        yoyo: true, repeat: -1,
        delay: Phaser.Math.Between(0, 2000),
      });
    }

    // ── Layout constants ──────────────────────────────────────────────────────
    // Total block height: simmie(140) + gaps + titles + balance + 4×button(54) + 3×gap(10) = 564
    // top margin = (640 - 564) / 2 = 38  →  equal top & bottom padding
    const cx = W / 2;
    const TOP = 38; // first pixel of content

    // ── Simmie sprite ─────────────────────────────────────────────────────────
    const mascot = this.add.image(cx, TOP + 70, 'simmie_menu'); // 140px tall → center at +70
    this.tweens.add({
      targets: mascot, y: mascot.y - 12,
      duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // ── Title ─────────────────────────────────────────────────────────────────
    this.add.text(cx, TOP + 172, "SIMMIE'S", {
      fontFamily: 'Inter, sans-serif', fontSize: '56px', fontStyle: '700',
      color: '#bffd11', stroke: '#0f172a', strokeThickness: 5,
    }).setOrigin(0.5);

    this.add.text(cx, TOP + 240, 'SIGNAL QUEST', {
      fontFamily: 'Inter, sans-serif', fontSize: '36px', fontStyle: '700',
      color: '#ffffff', stroke: '#0f172a', strokeThickness: 3,
    }).setOrigin(0.5);

    // Packet balance badge
    const save    = SaveService.load();
    const balance = this.add.text(cx, TOP + 288, `💾  ${save.totalPackets} MB saved`, {
      fontFamily: 'Inter, sans-serif', fontSize: '15px', color: '#64748b',
    }).setOrigin(0.5);
    this.tweens.add({ targets: balance, alpha: { from: 0.5, to: 1 }, duration: 1000, yoyo: true, repeat: -1 });

    // ── Buttons (4 × 54px + 10px gaps) ────────────────────────────────────────
    const btnStart = TOP + 318;
    const btnStep  = 64;
    this.makeButton(cx, btnStart,              '▶  PLAY GAME',   () => this.scene.start('GameScene'));
    this.makeButton(cx, btnStart + btnStep,     '🛒  DATA SHOP',   () => this.scene.start('ShopScene'));
    this.makeButton(cx, btnStart + btnStep * 2, '🏆  LEADERBOARD', () => this.scene.start('LeaderboardScene'));
    this.makeButton(cx, btnStart + btnStep * 3, '🎵  SOUNDTRACK',  () => this.scene.start('SoundtrackScene'));

    // ── Hologram branding ─────────────────────────────────────────────────────
    this.add.image(16, 16, 'hologram_logo').setOrigin(0, 0).setAlpha(0.7);

    // ── Mute toggle ───────────────────────────────────────────────────────────
    // Apply stored mute state to the sound manager
    this.sound.mute = MuteService.isMuted();
    const muteBtn = this.add.text(W - 14, 14, MuteService.isMuted() ? '🔇' : '🔊', {
      fontFamily: 'Inter, sans-serif', fontSize: '22px',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    muteBtn.on('pointerdown', () => {
      const muted = MuteService.toggle();
      muteBtn.setText(muted ? '🔇' : '🔊');
      this.sound.mute = muted;
    });

    // ── Version ───────────────────────────────────────────────────────────────
    this.add.text(W - 12, H - 10, 'v0.1 alpha', {
      fontFamily: 'Inter, sans-serif', fontSize: '11px', color: '#334155',
    }).setOrigin(1, 1);
  }

  private makeButton(x: number, y: number, label: string, cb: () => void) {
    const bg = this.add.rectangle(x, y, 300, 54, DARK)
      .setStrokeStyle(2, LIME)
      .setInteractive({ useHandCursor: true });

    const txt = this.add.text(x, y, label, {
      fontFamily: 'Inter, sans-serif', fontSize: '20px', fontStyle: '600',
      color: '#ffffff',
    }).setOrigin(0.5);

    bg.on('pointerover', () => { bg.setFillStyle(0x2d3f55); txt.setColor('#bffd11'); });
    bg.on('pointerout',  () => { bg.setFillStyle(DARK);     txt.setColor('#ffffff'); });
    bg.on('pointerdown', () => {
      this.tweens.add({ targets: bg, scaleX: 0.96, scaleY: 0.96, duration: 60, yoyo: true });
      this.time.delayedCall(80, cb);
    });
  }
}
