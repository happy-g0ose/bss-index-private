import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, Image, Zap, Eye, TrendingUp } from 'lucide-react';
import type { Language } from '../locales';
import { t } from '../locales';

export type Theme = 'dark' | 'light';
export type BgMode = 'dots' | 'grid' | 'solid' | 'aurora';

/** Background presets offered in the settings UI, with their i18n key. */
const BG_PRESETS: { id: BgMode; key: string }[] = [
  { id: 'dots', key: 'settings.bg.dots' },
  { id: 'grid', key: 'settings.bg.grid' },
  { id: 'solid', key: 'settings.bg.solid' },
  { id: 'aurora', key: 'settings.bg.aurora' },
];


interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  bg: BgMode;
  setBg: (bg: BgMode) => void;
  reduceMotion: boolean;
  setReduceMotion: (v: boolean) => void;
  showWeekBadges: boolean;
  setShowWeekBadges: (v: boolean) => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  lang,
  theme,
  setTheme,
  bg,
  setBg,
  reduceMotion,
  setReduceMotion,
  showWeekBadges,
  setShowWeekBadges,
}: SettingsModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 md:p-8">
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/85 backdrop-blur-md"
          />

          {/* Modal Window */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="relative w-full max-w-md rounded-2xl bg-[#0b0f19] border border-white/5 shadow-2xl overflow-hidden z-10 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-amber-400" />
                <span className="text-sm font-black uppercase tracking-wider text-white">
                  {t('settings.title', lang)}
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg border border-white/5 bg-neutral-900/40 hover:bg-neutral-900/80 transition-all cursor-pointer text-neutral-400 hover:text-neutral-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Theme picker */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5">
                  <Image className="h-3.5 w-3.5 text-neutral-500" />
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                    {t('settings.theme', lang)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(['dark', 'light'] as const).map((mode) => {
                    const active = theme === mode;
                    return (
                      <button
                        key={mode}
                        onClick={() => setTheme(mode)}
                        className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          active
                            ? 'bg-amber-500 border-amber-500 text-neutral-950 shadow-md'
                            : 'bg-neutral-900/40 border-white/5 text-neutral-400 hover:text-neutral-200 hover:border-white/10'
                        }`}
                      >
                        {mode === 'dark' ? '🌙 Dark' : '☀️ Light'}
                        {active && <span className="text-[10px]">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Background picker */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5">
                  <Image className="h-3.5 w-3.5 text-neutral-500" />
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                    {t('settings.bg', lang)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {BG_PRESETS.map((preset) => {
                    const active = bg === preset.id;
                    return (
                      <button
                        key={preset.id}
                        onClick={() => setBg(preset.id)}
                        title={t(preset.key, lang)}
                        className={`flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-xl border transition-all cursor-pointer ${
                          active
                            ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                            : 'bg-neutral-900/40 border-white/5 text-neutral-400 hover:border-white/15 hover:text-neutral-200'
                        }`}
                      >
                        {/* live swatch: the real background preset, rendered small */}
                        <span className={`h-7 w-full rounded-md border border-white/10 bgmode-${preset.id} shrink-0`} />
                        <span className="text-[10px] font-bold leading-tight text-center">
                          {t(preset.key, lang)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Behavior toggles */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-neutral-500" />
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                    {t('settings.behavior', lang)}
                  </span>
                </div>

                {/* Reduce motion */}
                <button
                  onClick={() => setReduceMotion(!reduceMotion)}
                  role="switch"
                  aria-checked={reduceMotion}
                  className="w-full flex items-center justify-between gap-3 p-3.5 rounded-xl border border-white/5 bg-neutral-900/30 hover:bg-neutral-900/50 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 text-left">
                    <Eye className="h-4 w-4 text-neutral-400 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-neutral-200">
                        {t('settings.reduceMotion', lang)}
                      </div>
                      <div className="text-[10px] text-neutral-500 mt-0.5">
                        {t('settings.reduceMotionDesc', lang)}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-300 ${
                      reduceMotion ? 'bg-amber-500' : 'bg-neutral-700'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 ${
                        reduceMotion ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </span>
                </button>

                {/* Weekly change badges */}
                <button
                  onClick={() => setShowWeekBadges(!showWeekBadges)}
                  role="switch"
                  aria-checked={showWeekBadges}
                  className="w-full flex items-center justify-between gap-3 p-3.5 rounded-xl border border-white/5 bg-neutral-900/30 hover:bg-neutral-900/50 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 text-left">
                    <TrendingUp className="h-4 w-4 text-neutral-400 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-neutral-200">
                        {t('settings.weekBadges', lang)}
                      </div>
                      <div className="text-[10px] text-neutral-500 mt-0.5">
                        {t('settings.weekBadgesDesc', lang)}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-300 ${
                      showWeekBadges ? 'bg-amber-500' : 'bg-neutral-700'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 ${
                        showWeekBadges ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
