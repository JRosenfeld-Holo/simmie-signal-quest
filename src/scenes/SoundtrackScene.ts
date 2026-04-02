import Phaser from 'phaser';

const LIME = 0xbffd11;
const NAVY = 0x0f172a;
const DARK = 0x1e293b;

interface TrackDef {
  key:   string;
  file:  string;
  title: string;
  label: string;
}

const TRACKS: TrackDef[] = [
  { key: 'st_menu',   file: 'menu_theme.mp3',     title: 'Menu Theme',          label: 'MENU'  },
  { key: 'st_lvl1',   file: 'Level 1.mp3',         title: 'Startup Signal',      label: 'LVL 1' },
  { key: 'st_lvl2',   file: 'Level 2.mp3',         title: 'Packet Storm',        label: 'LVL 2' },
  { key: 'st_lvl3',   file: 'Level 3.mp3',         title: 'Signal Interference', label: 'LVL 3' },
  { key: 'st_lvl4',   file: 'Level 4.mp3',         title: 'Network Congestion',  label: 'LVL 4' },
  { key: 'st_lvl5',   file: 'Level 5.mp3',         title: 'The Dead Zone',       label: 'LVL 5' },
  { key: 'st_end',    file: 'End Game Scene.mp3',  title: 'End Game',            label: 'END'   },
];

export default class SoundtrackScene extends Phaser.Scene {
  private currentTrackIdx = -1;
  private currentSound: Phaser.Sound.BaseSound | null = null;
  private nowPlayingText!: Phaser.GameObjects.Text;
  private rowHighlights: Phaser.GameObjects.Rectangle[] = [];
  private playIcons: Phaser.GameObjects.Text[] = [];
  private progressBarGfx!: Phaser.GameObjects.Graphics;
  private progressBarBg!: Phaser.GameObjects.Rectangle;
  private trackDurationTexts: Phaser.GameObjects.Text[] = [];

  constructor() { super({ key: 'SoundtrackScene' }); }

  preload() {
    this.sound.stopAll();
    for (const t of TRACKS) {
      if (!this.cache.audio.has(t.key)) {
        this.load.audio(t.key, `/assets/music/${t.file}`);
      }
    }
  }

  create() {
    const W  = this.cameras.main.width;
    const H  = this.cameras.main.height;
    const cx = W / 2;

    // ── Background ────────────────────────────────────────────────────────────
    this.add.rectangle(cx, H / 2, W, H, NAVY);
    const g = this.add.graphics();
    g.lineStyle(1, 0x1e293b, 0.4);
    for (let x = 0; x <= W; x += 100) { g.moveTo(x, 0); g.lineTo(x, H); }
    for (let y = 0; y <= H; y += 100) { g.moveTo(0, y); g.lineTo(W, y); }
    g.strokePath();

    // ── Title ─────────────────────────────────────────────────────────────────
    this.add.text(cx, 38, '🎵  SOUNDTRACK', {
      fontFamily: 'Inter, sans-serif', fontSize: '38px', fontStyle: '700',
      color: '#bffd11', stroke: '#0f172a', strokeThickness: 4,
    }).setOrigin(0.5);
    this.add.text(cx, 76, 'Listen to the full game OST', {
      fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#64748b',
    }).setOrigin(0.5);

    // ── Track list ────────────────────────────────────────────────────────────
    const listTop   = 108;
    const rowH      = 62;
    const listLeft  = cx - 380;
    const listRight = cx + 380;
    const listW     = listRight - listLeft;

    for (let i = 0; i < TRACKS.length; i++) {
      const t  = TRACKS[i];
      const ry = listTop + i * rowH;

      // Row bg (highlight when active)
      const rowBg = this.add.rectangle(
        listLeft + listW / 2, ry + rowH / 2,
        listW, rowH - 4, DARK, 0,
      ).setStrokeStyle(1, 0x334155, 0.5).setInteractive({ useHandCursor: true });
      this.rowHighlights.push(rowBg);

      // Track number badge
      this.add.rectangle(listLeft + 28, ry + rowH / 2, 40, 32, 0x1a2a40)
        .setStrokeStyle(1, LIME, 0.3);
      this.add.text(listLeft + 28, ry + rowH / 2, t.label, {
        fontFamily: 'Inter, sans-serif', fontSize: '10px', fontStyle: '700',
        color: '#64748b',
      }).setOrigin(0.5);

      // Play / pause icon
      const icon = this.add.text(listLeft + 66, ry + rowH / 2, '▶', {
        fontFamily: 'Inter, sans-serif', fontSize: '18px', color: '#475569',
      }).setOrigin(0.5);
      this.playIcons.push(icon);

      // Track title
      this.add.text(listLeft + 100, ry + rowH / 2 - 8, t.title, {
        fontFamily: 'Inter, sans-serif', fontSize: '17px', fontStyle: '600',
        color: '#ffffff',
      }).setOrigin(0, 0.5);

      // Waveform-style decoration bars
      const waveX = listRight - 100;
      const wg = this.add.graphics();
      const barCount = 14;
      for (let b = 0; b < barCount; b++) {
        const bh = Phaser.Math.Between(4, 18);
        const bx = waveX + b * 6;
        wg.fillStyle(LIME, 0.15);
        wg.fillRect(bx, ry + rowH / 2 - bh / 2, 3, bh);
      }

      // Click handler
      const idx = i;
      rowBg.on('pointerover', () => { if (idx !== this.currentTrackIdx) rowBg.setFillStyle(0x1a2a3a, 0.6); });
      rowBg.on('pointerout',  () => { if (idx !== this.currentTrackIdx) rowBg.setFillStyle(DARK, 0); });
      rowBg.on('pointerdown', () => this.selectTrack(idx));
    }

    // ── Progress bar ──────────────────────────────────────────────────────────
    const barY = listTop + TRACKS.length * rowH + 18;
    this.add.text(cx, barY - 12, 'NOW PLAYING', {
      fontFamily: 'Inter, sans-serif', fontSize: '10px', fontStyle: '700',
      color: '#334155', letterSpacing: 3,
    }).setOrigin(0.5);

    this.nowPlayingText = this.add.text(cx, barY + 6, '— not playing —', {
      fontFamily: 'Inter, sans-serif', fontSize: '15px', fontStyle: '600',
      color: '#64748b',
    }).setOrigin(0.5);

    this.progressBarBg = this.add.rectangle(cx, barY + 30, listW, 6, 0x1e293b)
      .setStrokeStyle(1, 0x334155);
    this.progressBarGfx = this.add.graphics();

    // ── Controls hint ────────────────────────────────────────────────────────
    this.add.text(cx, barY + 52, 'Click a track to play · Click again to pause', {
      fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#334155',
    }).setOrigin(0.5);

    // ── Back button ───────────────────────────────────────────────────────────
    const backBg = this.add.rectangle(cx, H - 38, 220, 44, DARK)
      .setStrokeStyle(2, 0x334155).setInteractive({ useHandCursor: true });
    const backTxt = this.add.text(cx, H - 38, '← BACK TO MENU', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px', fontStyle: '600',
      color: '#94a3b8',
    }).setOrigin(0.5);
    backBg.on('pointerover', () => { backBg.setStrokeStyle(2, LIME); backTxt.setColor('#bffd11'); });
    backBg.on('pointerout',  () => { backBg.setStrokeStyle(2, 0x334155); backTxt.setColor('#94a3b8'); });
    backBg.on('pointerdown', () => { this.currentSound?.stop(); this.scene.start('MenuScene'); });

    // Tick progress bar every frame
    this.events.on('shutdown', () => { this.currentSound?.stop(); });
  }

  update() {
    if (!this.currentSound || !this.currentSound.isPlaying) return;
    const sound = this.currentSound as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound;
    const seek     = (sound as Phaser.Sound.WebAudioSound).seek ?? 0;
    const duration = (sound as Phaser.Sound.WebAudioSound).duration ?? 1;
    const frac     = duration > 0 ? Math.min(1, seek / duration) : 0;
    const barW     = this.progressBarBg.width;
    const barX     = this.progressBarBg.x - barW / 2;
    const barY     = this.progressBarBg.y - 3;
    this.progressBarGfx.clear();
    this.progressBarGfx.fillStyle(LIME, 0.8);
    this.progressBarGfx.fillRoundedRect(barX, barY, Math.round(barW * frac), 6, 3);
  }

  private selectTrack(idx: number) {
    if (idx === this.currentTrackIdx && this.currentSound?.isPlaying) {
      // Pause current
      (this.currentSound as Phaser.Sound.WebAudioSound).pause();
      this.playIcons[idx].setText('▶').setColor('#475569');
      this.nowPlayingText.setText('— paused —').setColor('#64748b');
      return;
    }

    if (this.currentSound) {
      this.currentSound.stop();
      if (this.currentTrackIdx >= 0) {
        this.playIcons[this.currentTrackIdx].setText('▶').setColor('#475569');
        this.rowHighlights[this.currentTrackIdx].setFillStyle(DARK, 0);
      }
    }

    this.currentTrackIdx = idx;
    const t = TRACKS[idx];

    // Resume if it was paused
    const existing = this.sound.get(t.key) as Phaser.Sound.WebAudioSound | null;
    if (existing && !existing.isPlaying) {
      existing.resume();
      this.currentSound = existing;
    } else {
      this.currentSound = this.sound.add(t.key, { loop: false, volume: 0.6 });
      this.currentSound.play();
      this.currentSound.once('complete', () => {
        this.playIcons[idx].setText('▶').setColor('#475569');
        this.rowHighlights[idx].setFillStyle(DARK, 0);
        this.nowPlayingText.setText('— not playing —').setColor('#64748b');
        this.currentTrackIdx = -1;
        this.currentSound = null;
      });
    }

    this.playIcons[idx].setText('⏸').setColor('#bffd11');
    this.rowHighlights[idx].setFillStyle(0x0d1f10, 1);
    this.nowPlayingText.setText(t.title).setColor('#bffd11');
  }
}
