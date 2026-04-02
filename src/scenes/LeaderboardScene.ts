import Phaser from 'phaser';
import { SaveService, type LeaderboardEntry } from '../services/SaveService';

const LIME = 0xbffd11;
const NAVY = 0x0f172a;
const DARK = 0x1e293b;

// Mock leaderboard seeded for demo — swapped out once SaveService.fetchLeaderboard()
// points to a real backend.
const MOCK_ENTRIES: LeaderboardEntry[] = [
  { name: 'Signal_Simmie',  score: 1240 },
  { name: 'PacketRunner',   score: 1080 },
  { name: 'CellTowerCzar',  score:  970 },
  { name: 'LatencyKiller',  score:  890 },
  { name: 'DataDreamer',    score:  760 },
  { name: 'RoamingRacer',   score:  680 },
  { name: 'ByteBasher',     score:  540 },
  { name: 'PingMaster',     score:  430 },
  { name: 'FirmwareNinja',  score:  390 },
  { name: 'GlobalSimGuru',  score:  210 },
];

export default class LeaderboardScene extends Phaser.Scene {
  constructor() { super({ key: 'LeaderboardScene' }); }

  async create() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    // ── Background ────────────────────────────────────────────────────────────
    this.add.rectangle(W / 2, H / 2, W, H, NAVY);
    const g = this.add.graphics();
    g.lineStyle(1, 0x1e293b, 0.4);
    for (let x = 0; x <= W; x += 100) { g.moveTo(x, 0); g.lineTo(x, H); }
    for (let y = 0; y <= H; y += 100) { g.moveTo(0, y); g.lineTo(W, y); }
    g.strokePath();

    // ── Title ─────────────────────────────────────────────────────────────────
    this.add.text(W / 2, 44, '🏆  SIGNAL LEADERBOARD', {
      fontFamily: 'Inter, sans-serif', fontSize: '42px', fontStyle: '700',
      color: '#bffd11', stroke: '#0f172a', strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(W / 2, 92, 'Top 10 Data Uploaders', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px', color: '#64748b',
    }).setOrigin(0.5);

    // ── Loading indicator ─────────────────────────────────────────────────────
    const loading = this.add.text(W / 2, H / 2, 'Fetching signal data…', {
      fontFamily: 'Inter, sans-serif', fontSize: '18px', color: '#475569',
    }).setOrigin(0.5);

    // ── Fetch entries (ready to swap to real API via SaveService.fetchLeaderboard) ──
    let entries: LeaderboardEntry[] = [];
    try {
      const saved = await SaveService.fetchLeaderboard();
      // Merge player's saved entries with mock data; deduplicate by score
      entries = [...saved, ...MOCK_ENTRIES]
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
    } catch {
      entries = MOCK_ENTRIES;
    }

    loading.destroy();

    // ── Table ─────────────────────────────────────────────────────────────────
    const tableX     = W / 2;
    const tableStartY = 138;
    const rowH       = 44;
    const colW       = [60, 360, 160]; // rank | name | score
    const totalTW    = colW.reduce((a, b) => a + b, 0);
    const tableLeft  = tableX - totalTW / 2;

    // Header
    this.add.rectangle(tableX, tableStartY + 14, totalTW, 30, 0x1a2540).setOrigin(0.5);
    this.headerCell(tableLeft + colW[0] / 2,           tableStartY + 14, '#');
    this.headerCell(tableLeft + colW[0] + colW[1] / 2, tableStartY + 14, 'PLAYER');
    this.headerCell(tableLeft + colW[0] + colW[1] + colW[2] / 2, tableStartY + 14, 'DATA UPLOADED');

    // Separator
    const gSep = this.add.graphics();
    gSep.lineStyle(1, LIME, 0.5);
    gSep.moveTo(tableLeft, tableStartY + 30); gSep.lineTo(tableLeft + totalTW, tableStartY + 30);
    gSep.strokePath();

    // Rows
    entries.forEach((entry, i) => {
      const ry       = tableStartY + 30 + (i + 1) * rowH - rowH / 2 + 8;
      const isTop3   = i < 3;
      const rowColor = i % 2 === 0 ? 0x111827 : DARK;
      this.add.rectangle(tableX, ry, totalTW, rowH - 2, rowColor, 0.6).setOrigin(0.5);

      // Rank medal
      const medal = ['🥇', '🥈', '🥉'][i] ?? `${i + 1}`;
      this.rowCell(tableLeft + colW[0] / 2, ry, medal, isTop3 ? '#bffd11' : '#94a3b8', isTop3 ? '18px' : '16px');
      // Name
      this.rowCell(tableLeft + colW[0] + colW[1] / 2, ry, entry.name,
        isTop3 ? '#ffffff' : '#94a3b8', isTop3 ? '16px' : '15px');
      // Score
      this.rowCell(tableLeft + colW[0] + colW[1] + colW[2] / 2, ry,
        `${entry.score} MB`, isTop3 ? '#bffd11' : '#64748b', isTop3 ? '16px' : '15px');
    });

    if (entries.length === 0) {
      this.add.text(W / 2, H / 2, 'No scores yet — play and upload data!', {
        fontFamily: 'Inter, sans-serif', fontSize: '18px', color: '#475569',
      }).setOrigin(0.5);
    }

    // ── Back button ───────────────────────────────────────────────────────────
    const backBg = this.add.rectangle(W / 2, H - 48, 240, 46, DARK)
      .setStrokeStyle(2, 0x334155)
      .setInteractive({ useHandCursor: true });
    const backTxt = this.add.text(W / 2, H - 48, '← BACK TO MENU', {
      fontFamily: 'Inter, sans-serif', fontSize: '17px', fontStyle: '600',
      color: '#94a3b8',
    }).setOrigin(0.5);
    backBg.on('pointerover', () => { backBg.setStrokeStyle(2, LIME); backTxt.setColor('#bffd11'); });
    backBg.on('pointerout',  () => { backBg.setStrokeStyle(2, 0x334155); backTxt.setColor('#94a3b8'); });
    backBg.on('pointerdown', () => this.scene.start('MenuScene'));
  }

  private headerCell(x: number, y: number, text: string) {
    this.add.text(x, y, text, {
      fontFamily: 'Inter, sans-serif', fontSize: '13px', fontStyle: '700',
      color: '#bffd11',
    }).setOrigin(0.5);
  }

  private rowCell(x: number, y: number, text: string, color: string, size: string) {
    this.add.text(x, y, text, {
      fontFamily: 'Inter, sans-serif', fontSize: size, color,
    }).setOrigin(0.5);
  }
}
