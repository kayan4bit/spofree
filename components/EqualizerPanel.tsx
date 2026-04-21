import React, { useState } from 'react';
import { Sliders, RotateCcw, Power, Gauge } from 'lucide-react';
import { audioEngine, EQ_BANDS, EQ_PRESETS } from '../services/audioEngine';

interface Props {
  onClose: () => void;
  accentColor: string;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export const EqualizerPanel: React.FC<Props> = ({ onClose, accentColor }) => {
  const [gains, setGains] = useState<number[]>(() => audioEngine.getGains());
  const [preset, setPreset] = useState<string>(() => audioEngine.getPreset());
  const [enabled, setEnabled] = useState<boolean>(() => audioEngine.isEnabled());
  const [rate, setRate] = useState<number>(() => audioEngine.getPlaybackRate());

  const updateBand = (i: number, v: number) => {
    const next = gains.slice();
    next[i] = v;
    setGains(next);
    audioEngine.setBand(i, v);
    setPreset('Custom');
    try { localStorage.setItem('atomic_eq_preset_v1', 'Custom'); } catch {}
  };

  const selectPreset = (name: string) => {
    setPreset(name);
    audioEngine.applyPreset(name);
    setGains(EQ_PRESETS[name]?.slice() || EQ_BANDS.map(() => 0));
  };

  const reset = () => selectPreset('Flat');

  const changeRate = (r: number) => {
    setRate(r);
    const audio = document.querySelector('audio') as HTMLAudioElement | null;
    audioEngine.setPlaybackRate(audio, r);
  };

  const toggleEnabled = () => {
    const next = !enabled;
    setEnabled(next);
    audioEngine.setEnabled(next);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-scale-in" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="atomic-glass-strong rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-[color:var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <Sliders size={20} style={{ color: accentColor }} />
            <h2 className="text-xl font-bold">Equalizer</h2>
            <span className="text-xs text-white/50 ml-2">10-band parametric</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={reset} title="Reset to Flat" className="p-2 rounded-md hover:bg-white/10 text-white/70"><RotateCcw size={16} /></button>
            <button
              onClick={toggleEnabled}
              title={enabled ? 'Disable EQ' : 'Enable EQ'}
              className={`p-2 rounded-md flex items-center gap-2 ${enabled ? 'bg-white/10' : 'bg-white/5 text-white/50'}`}
            >
              <Power size={16} />
              <span className="text-xs font-medium">{enabled ? 'On' : 'Off'}</span>
            </button>
            <button onClick={onClose} className="px-3 py-1.5 rounded-md bg-white text-black text-sm font-semibold hover:opacity-90">Done</button>
          </div>
        </div>

        <div className="p-5 flex flex-col gap-6">
          {/* Presets */}
          <div>
            <div className="text-xs uppercase tracking-widest text-white/50 mb-2">Presets</div>
            <div className="flex flex-wrap gap-2">
              {['Flat', 'Bass Boost', 'Vocal', 'Classical', 'Rock', 'Electronic', 'Lo-Fi', 'Treble', 'Podcast', 'Custom'].map((p) => (
                <button
                  key={p}
                  onClick={() => p !== 'Custom' && selectPreset(p)}
                  disabled={p === 'Custom'}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium atomic-chip ${preset === p ? 'atomic-chip-active' : ''} ${p === 'Custom' ? 'opacity-60 cursor-default' : ''}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Bands */}
          <div>
            <div className="text-xs uppercase tracking-widest text-white/50 mb-2">Bands (dB)</div>
            <div className="grid grid-cols-10 gap-2">
              {EQ_BANDS.map((band, i) => (
                <div key={band.freq} className="flex flex-col items-center gap-2">
                  <span className="text-[10px] tabular-nums text-white/60">{gains[i] > 0 ? '+' : ''}{gains[i].toFixed(0)}</span>
                  <input
                    type="range"
                    min="-12"
                    max="12"
                    step="1"
                    value={gains[i]}
                    onChange={(e) => updateBand(i, parseFloat(e.target.value))}
                    className="h-28 w-2 appearance-none eq-slider"
                    style={{
                      writingMode: 'vertical-lr' as any,
                      // @ts-ignore - vendor property
                      WebkitAppearance: 'slider-vertical',
                      direction: 'rtl',
                      accentColor,
                    } as React.CSSProperties}
                    disabled={!enabled}
                  />
                  <span className="text-[10px] text-white/60">{band.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Playback speed */}
          <div>
            <div className="text-xs uppercase tracking-widest text-white/50 mb-2 flex items-center gap-2">
              <Gauge size={14} /> Playback speed
            </div>
            <div className="flex flex-wrap gap-2">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => changeRate(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium atomic-chip ${Math.abs(rate - s) < 0.001 ? 'atomic-chip-active' : ''}`}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
