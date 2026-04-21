// Shared Web Audio graph used by Player + Equalizer.
// Graph: MediaElementSource -> [10 BiquadFilter bands] -> AnalyserNode -> destination.
// Gains and preset are persisted in localStorage.

export const EQ_BANDS: { freq: number; label: string; type: BiquadFilterType }[] = [
  { freq: 32,    label: '32',   type: 'lowshelf'  },
  { freq: 64,    label: '64',   type: 'peaking'   },
  { freq: 125,   label: '125',  type: 'peaking'   },
  { freq: 250,   label: '250',  type: 'peaking'   },
  { freq: 500,   label: '500',  type: 'peaking'   },
  { freq: 1000,  label: '1K',   type: 'peaking'   },
  { freq: 2000,  label: '2K',   type: 'peaking'   },
  { freq: 4000,  label: '4K',   type: 'peaking'   },
  { freq: 8000,  label: '8K',   type: 'peaking'   },
  { freq: 16000, label: '16K',  type: 'highshelf' },
];

export const EQ_PRESETS: Record<string, number[]> = {
  Flat:        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'Bass Boost':[6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
  Vocal:       [-2, -2, -1, 0, 2, 3, 4, 3, 1, 0],
  Classical:   [4, 3, 2, 2, 0, 0, -1, -1, 0, 2],
  Rock:        [4, 3, 2, 1, -1, -1, 1, 2, 3, 4],
  Electronic:  [4, 3, 1, 0, -2, 1, 0, 1, 3, 4],
  'Lo-Fi':     [3, 2, 2, 1, 0, -2, -3, -4, -5, -6],
  Treble:      [0, 0, 0, 0, 0, 1, 2, 3, 4, 5],
  Podcast:     [-3, -3, -2, 0, 3, 4, 3, 2, 0, -1],
};

const GAINS_KEY = 'atomic_eq_gains_v1';
const PRESET_KEY = 'atomic_eq_preset_v1';
const ENABLED_KEY = 'atomic_eq_enabled_v1';
const RATE_KEY = 'atomic_playback_rate_v1';

export const audioEngine = {
  ctx: null as AudioContext | null,
  source: null as MediaElementAudioSourceNode | null,
  filters: [] as BiquadFilterNode[],
  analyser: null as AnalyserNode | null,
  currentElement: null as HTMLAudioElement | null,

  init(el: HTMLAudioElement): AnalyserNode | null {
    if (this.ctx && this.currentElement === el) return this.analyser;
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      const ctx: AudioContext = this.ctx || new AC();
      this.ctx = ctx;

      // Creating MediaElementSource twice on the same element throws.
      // If we already wired this element, keep the existing source.
      if (this.currentElement !== el) {
        this.source = ctx.createMediaElementSource(el);
        this.currentElement = el;
      }

      if (this.filters.length === 0) {
        this.filters = EQ_BANDS.map((band) => {
          const f = ctx.createBiquadFilter();
          f.type = band.type;
          f.frequency.value = band.freq;
          f.Q.value = band.type === 'peaking' ? 1 : 0.7;
          f.gain.value = 0;
          return f;
        });
      }

      if (!this.analyser) {
        const an = ctx.createAnalyser();
        an.fftSize = 256;
        this.analyser = an;
      }

      // Wire: source -> filters... -> analyser -> destination
      if (this.source) this.source.disconnect();
      this.filters.forEach((f) => f.disconnect());
      this.analyser.disconnect();

      const enabled = this.isEnabled();
      if (enabled && this.source) {
        this.source.connect(this.filters[0]);
        for (let i = 0; i < this.filters.length - 1; i++) {
          this.filters[i].connect(this.filters[i + 1]);
        }
        this.filters[this.filters.length - 1].connect(this.analyser);
      } else if (this.source) {
        this.source.connect(this.analyser);
      }
      this.analyser.connect(ctx.destination);

      // Restore persisted gains
      const gains = this.getGains();
      this.applyGains(gains);

      return this.analyser;
    } catch (e) {
      console.warn('audioEngine init failed', e);
      return null;
    }
  },

  resume() {
    if (this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {});
  },

  getGains(): number[] {
    try {
      const raw = localStorage.getItem(GAINS_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length === EQ_BANDS.length) return arr.map((v) => Number(v) || 0);
      }
    } catch {}
    return EQ_BANDS.map(() => 0);
  },

  applyGains(gains: number[]) {
    try { localStorage.setItem(GAINS_KEY, JSON.stringify(gains)); } catch {}
    this.filters.forEach((f, i) => {
      if (!f) return;
      const g = Math.max(-12, Math.min(12, Number(gains[i]) || 0));
      try { f.gain.setTargetAtTime(g, this.ctx?.currentTime || 0, 0.02); } catch { f.gain.value = g; }
    });
  },

  setBand(i: number, value: number) {
    const gains = this.getGains();
    gains[i] = value;
    this.applyGains(gains);
  },

  getPreset(): string {
    try { return localStorage.getItem(PRESET_KEY) || 'Flat'; } catch { return 'Flat'; }
  },

  applyPreset(name: string) {
    const preset = EQ_PRESETS[name] || EQ_PRESETS.Flat;
    try { localStorage.setItem(PRESET_KEY, name); } catch {}
    this.applyGains(preset.slice());
  },

  isEnabled(): boolean {
    try { return localStorage.getItem(ENABLED_KEY) !== 'false'; } catch { return true; }
  },

  setEnabled(enabled: boolean) {
    try { localStorage.setItem(ENABLED_KEY, String(enabled)); } catch {}
    if (!this.ctx || !this.source || !this.analyser) return;
    this.source.disconnect();
    this.filters.forEach((f) => f.disconnect());
    this.analyser.disconnect();
    if (enabled) {
      this.source.connect(this.filters[0]);
      for (let i = 0; i < this.filters.length - 1; i++) this.filters[i].connect(this.filters[i + 1]);
      this.filters[this.filters.length - 1].connect(this.analyser);
    } else {
      this.source.connect(this.analyser);
    }
    this.analyser.connect(this.ctx.destination);
  },

  // Playback rate
  getPlaybackRate(): number {
    try {
      const v = parseFloat(localStorage.getItem(RATE_KEY) || '1');
      if (!isNaN(v) && v >= 0.25 && v <= 4) return v;
    } catch {}
    return 1;
  },

  setPlaybackRate(el: HTMLAudioElement | null, rate: number) {
    try { localStorage.setItem(RATE_KEY, String(rate)); } catch {}
    if (el) el.playbackRate = rate;
  },
};
