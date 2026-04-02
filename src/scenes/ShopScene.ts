import Phaser from 'phaser';
import { SaveService, UPGRADE_COSTS, type Upgrades } from '../services/SaveService';

const LIME = 0xbffd11;
const NAVY = 0x0f172a;
const DARK = 0x1e293b;

interface UpgradeDef {
  key:    keyof Upgrades;
  icon:   string;
  title:  string;
  desc:   string;
  costs:  number[];           // cost per level (single-element for boolean upgrades)
  maxLvl: number;
}

const UPGRADES: UpgradeDef[] = [
  {
    key:   'bandwidthBoost',
    icon:  '⚡',
    title: 'BANDWIDTH BOOST',
    desc:  'Increase Simmie\'s move speed.\nLevel I +15%  ·  II +30%  ·  III +45%',
    costs: UPGRADE_COSTS.bandwidthBoostLevels as unknown as number[],
    maxLvl: 3,
  },
  {
    key:   'signalAmp',
    icon:  '📶',
    title: 'SIGNAL AMP',
    desc:  'Add a 5th Signal Bar — one extra\nhit before connection drops.',
    costs: [UPGRADE_COSTS.signalAmp],
    maxLvl: 1,
  },
  {
    key:   'packetSniffer',
    icon:  '🧲',
    title: 'PACKET SNIFFER',
    desc:  'Data Packets nearby are magnetically\npulled toward Simmie.',
    costs: [UPGRADE_COSTS.packetSniffer],
    maxLvl: 1,
  },
];

export default class ShopScene extends Phaser.Scene {
  private balanceText!: Phaser.GameObjects.Text;
  private cardTexts: Map<keyof Upgrades, {
    levelText: Phaser.GameObjects.Text;
    btnTxt:    Phaser.GameObjects.Text;
    btnBg:     Phaser.GameObjects.Rectangle;
    feedbackTxt: Phaser.GameObjects.Text;
  }> = new Map();

  constructor() { super({ key: 'ShopScene' }); }

  create() {
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
    this.add.text(W / 2, 44, 'THE DATA SHOP', {
      fontFamily: 'Inter, sans-serif', fontSize: '44px', fontStyle: '700',
      color: '#bffd11', stroke: '#0f172a', strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(W / 2, 90, 'Spend your collected Data Packets to upgrade Simmie', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px', color: '#64748b',
    }).setOrigin(0.5);

    // Balance
    this.balanceText = this.add.text(W / 2, 126, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '20px', fontStyle: '600',
      color: '#ffffff', stroke: '#0f172a', strokeThickness: 2,
    }).setOrigin(0.5);
    this.refreshBalance();

    // ── Upgrade cards ─────────────────────────────────────────────────────────
    const cardW = 340, cardH = 200, gap = 30;
    const totalW = UPGRADES.length * cardW + (UPGRADES.length - 1) * gap;
    const startX = (W - totalW) / 2;

    UPGRADES.forEach((upg, i) => {
      const cx = startX + i * (cardW + gap) + cardW / 2;
      const cy = H / 2 + 20;
      this.buildCard(upg, cx, cy, cardW, cardH);
    });

    // ── Back button ───────────────────────────────────────────────────────────
    const backBg = this.add.rectangle(W / 2, H - 48, 220, 46, DARK)
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

  private buildCard(upg: UpgradeDef, cx: number, cy: number, cw: number, ch: number) {
    const save = SaveService.load();
    const currentLevel = upg.maxLvl === 1
      ? (save.upgrades[upg.key] ? 1 : 0)
      : (save.upgrades[upg.key] as number);

    const isMaxed = currentLevel >= upg.maxLvl;
    const cost    = isMaxed ? 0 : upg.costs[currentLevel];

    // Card bg
    const card = this.add.rectangle(cx, cy, cw, ch, DARK)
      .setStrokeStyle(2, isMaxed ? LIME : 0x334155);

    // Icon + title
    this.add.text(cx, cy - ch / 2 + 24, upg.icon, {
      fontSize: '28px',
    }).setOrigin(0.5);

    this.add.text(cx, cy - ch / 2 + 60, upg.title, {
      fontFamily: 'Inter, sans-serif', fontSize: '16px', fontStyle: '700',
      color: '#bffd11',
    }).setOrigin(0.5);

    this.add.text(cx, cy - ch / 2 + 94, upg.desc, {
      fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#94a3b8',
      align: 'center', wordWrap: { width: cw - 24 },
    }).setOrigin(0.5);

    // Level indicator
    const levelText = this.add.text(cx, cy + ch / 2 - 74, this.levelLabel(upg, currentLevel), {
      fontFamily: 'Inter, sans-serif', fontSize: '13px', fontStyle: '600',
      color: isMaxed ? '#bffd11' : '#64748b',
    }).setOrigin(0.5);

    // Buy button
    const btnBg = this.add.rectangle(cx, cy + ch / 2 - 36, 180, 40, isMaxed ? 0x1a3010 : 0x1e293b)
      .setStrokeStyle(2, isMaxed ? LIME : 0x475569)
      .setInteractive({ useHandCursor: !isMaxed });

    const btnTxt = this.add.text(cx, cy + ch / 2 - 36,
      isMaxed ? 'MAX LEVEL' : `BUY  ${cost} MB`,
      {
        fontFamily: 'Inter, sans-serif', fontSize: '15px', fontStyle: '700',
        color: isMaxed ? '#bffd11' : '#ffffff',
      },
    ).setOrigin(0.5);

    // Feedback text (hidden initially)
    const feedbackTxt = this.add.text(cx, cy + ch / 2 - 36, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '13px', fontStyle: '700',
      color: '#bffd11',
    }).setOrigin(0.5).setAlpha(0);

    this.cardTexts.set(upg.key, { levelText, btnTxt, btnBg, feedbackTxt });

    if (!isMaxed) {
      btnBg.on('pointerover', () => { btnBg.setFillStyle(0x334155); });
      btnBg.on('pointerout',  () => { btnBg.setFillStyle(0x1e293b); });
      btnBg.on('pointerdown', () => this.attemptBuy(upg, card, btnBg, btnTxt, levelText, feedbackTxt));
    }

    void card; // suppress unused warning
  }

  private attemptBuy(
    upg: UpgradeDef,
    card: Phaser.GameObjects.Rectangle,
    btnBg: Phaser.GameObjects.Rectangle,
    btnTxt: Phaser.GameObjects.Text,
    levelText: Phaser.GameObjects.Text,
    feedbackTxt: Phaser.GameObjects.Text,
  ) {
    const result = SaveService.buyUpgrade(upg.key);
    this.refreshBalance();

    const color = result.ok ? '#bffd11' : '#ff3b3b';
    feedbackTxt.setText(result.message).setColor(color).setAlpha(1);
    this.tweens.add({
      targets: feedbackTxt, alpha: 0, delay: 1400, duration: 500,
    });

    if (result.ok) {
      const save         = SaveService.load();
      const currentLevel = upg.maxLvl === 1
        ? (save.upgrades[upg.key] ? 1 : 0)
        : (save.upgrades[upg.key] as number);
      const isMaxed = currentLevel >= upg.maxLvl;
      const newCost = isMaxed ? 0 : upg.costs[currentLevel];

      levelText.setText(this.levelLabel(upg, currentLevel));
      btnTxt.setText(isMaxed ? 'MAX LEVEL' : `BUY  ${newCost} MB`);

      if (isMaxed) {
        levelText.setColor('#bffd11');
        btnBg.setStrokeStyle(2, LIME).setFillStyle(0x1a3010);
        btnTxt.setColor('#bffd11');
        card.setStrokeStyle(2, LIME);
        btnBg.removeAllListeners();
      }

      this.tweens.add({ targets: card, scaleX: 1.04, scaleY: 1.04, duration: 80, yoyo: true });
    }
  }

  private levelLabel(upg: UpgradeDef, level: number): string {
    if (upg.maxLvl === 1) return level ? '✓ OWNED' : 'NOT OWNED';
    if (level === 0)          return 'NOT OWNED';
    if (level >= upg.maxLvl)  return `LEVEL ${level}  ★ MAX`;
    return `LEVEL ${level} / ${upg.maxLvl}`;
  }

  private refreshBalance() {
    const save = SaveService.load();
    this.balanceText.setText(`Balance:  ${save.totalPackets} MB`);
  }
}
