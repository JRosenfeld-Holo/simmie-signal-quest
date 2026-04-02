const KEY = 'simmie_muted';

export const MuteService = {
  isMuted(): boolean {
    return localStorage.getItem(KEY) === '1';
  },
  setMuted(muted: boolean): void {
    localStorage.setItem(KEY, muted ? '1' : '0');
  },
  toggle(): boolean {
    const next = !this.isMuted();
    this.setMuted(next);
    return next;
  },
};
