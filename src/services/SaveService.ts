// ─── Types ────────────────────────────────────────────────────────────────────

export interface Upgrades {
  /** 0 = none | 1 = +15% | 2 = +30% | 3 = +45% speed */
  bandwidthBoost: number;
  /** Adds a 5th signal bar */
  signalAmp: boolean;
  /** Collectibles magnetic pull */
  packetSniffer: boolean;
}

export interface LeaderboardEntry {
  name: string;
  score: number;
}

export interface SaveData {
  totalPackets: number;
  upgrades: Upgrades;
  leaderboard: LeaderboardEntry[];
}

// ─── Upgrade shop costs ───────────────────────────────────────────────────────

export const UPGRADE_COSTS = {
  bandwidthBoostLevels: [50, 100, 200], // cost per level
  signalAmp: 150,
  packetSniffer: 100,
} as const;

// ─── Service ──────────────────────────────────────────────────────────────────

const SAVE_KEY = 'simmie_v1';

function blank(): SaveData {
  return {
    totalPackets: 0,
    upgrades: { bandwidthBoost: 0, signalAmp: false, packetSniffer: false },
    leaderboard: [],
  };
}

export const SaveService = {
  /** Load save from localStorage, with safe defaults */
  load(): SaveData {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return blank();
      const p = JSON.parse(raw) as Partial<SaveData>;
      return {
        totalPackets: p.totalPackets ?? 0,
        upgrades: {
          bandwidthBoost: p.upgrades?.bandwidthBoost ?? 0,
          signalAmp:      p.upgrades?.signalAmp      ?? false,
          packetSniffer:  p.upgrades?.packetSniffer  ?? false,
        },
        leaderboard: Array.isArray(p.leaderboard) ? p.leaderboard : [],
      };
    } catch {
      return blank();
    }
  },

  save(data: SaveData): void {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  },

  addPackets(count: number): void {
    const data = this.load();
    data.totalPackets += count;
    this.save(data);
  },

  spendPackets(cost: number): boolean {
    const data = this.load();
    if (data.totalPackets < cost) return false;
    data.totalPackets -= cost;
    this.save(data);
    return true;
  },

  buyUpgrade(key: keyof Upgrades): { ok: boolean; message: string } {
    const data = this.load();
    if (key === 'bandwidthBoost') {
      const current = data.upgrades.bandwidthBoost;
      if (current >= 3) return { ok: false, message: 'MAX LEVEL' };
      const cost = UPGRADE_COSTS.bandwidthBoostLevels[current];
      if (data.totalPackets < cost) return { ok: false, message: 'NOT ENOUGH MB' };
      data.totalPackets -= cost;
      data.upgrades.bandwidthBoost++;
      this.save(data);
      return { ok: true, message: `LEVEL ${data.upgrades.bandwidthBoost} ACTIVE` };
    }
    if (data.upgrades[key]) return { ok: false, message: 'ALREADY OWNED' };
    const cost = key === 'signalAmp' ? UPGRADE_COSTS.signalAmp : UPGRADE_COSTS.packetSniffer;
    if (data.totalPackets < cost) return { ok: false, message: 'NOT ENOUGH MB' };
    data.totalPackets -= cost;
    (data.upgrades[key] as boolean) = true;
    this.save(data);
    return { ok: true, message: 'PURCHASED!' };
  },

  /** Submit a score and keep top-10 sorted list */
  async submitScore(name: string, score: number): Promise<void> {
    // Structure is ready to swap this body for a fetch() call to a live backend:
    //   await fetch('/api/leaderboard', { method: 'POST', body: JSON.stringify({ name, score }) });
    const data = this.load();
    data.leaderboard.push({ name, score });
    data.leaderboard.sort((a, b) => b.score - a.score);
    data.leaderboard = data.leaderboard.slice(0, 10);
    this.save(data);
  },

  /** Fetch top-10 leaderboard.
   *  Structured so the body can be replaced with a real fetch() call later. */
  async fetchLeaderboard(): Promise<LeaderboardEntry[]> {
    // Swap out the body below to call a real API:
    //   const res = await fetch('/api/leaderboard?limit=10');
    //   return res.json() as Promise<LeaderboardEntry[]>;
    return this.load().leaderboard;
  },
};
