import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, Image, Zap, Eye } from 'lucide-react';
import type { Language } from '../locales';
import { t } from '../locales';

export type BgMode = 'solid' | 'grid' | 'dots' | 'gradient';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  bg: BgMode;
  setBg: (bg: BgMode) => void;
  reduceMotion: boolean;
  setReduceMotion: (v: boolean) => void;
  showWeekBadges: boolean;
  setShowWeekBadges: (v: boolean) => void;
}

const BG_MODES: BgMode[] = ['solid', 'grid', 'dots', 'gradient'];

export default function SettingsModal({
  isOpen,
  onClose,
  lang,
  bg,
  setBg,
  reduceMotion,
  setReduceMotion,
  showWeekBadges,
  setShowWeekBadges,
}: SettingsModalProps) {
  // Lock body scroll when open
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

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const bgPreviewClass: Record<BgMode, string> = {
    grid: 'bgmode-grid',
    dots: 'bgmode-dots',
    gradient: 'bgmode-gradient',
    solid: 'bgmode-solid',
  };

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
            <div className="p-6 space-y-6">
              {/* Background picker */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5">
                  <Image className="h-3.5 w-3.5 text-neutral-500" />
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                    {t('settings.bg', lang)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {BG_MODES.map((mode) => {
                    const active = bg === mode;
                    return (
                      <button
                        key={mode}
                        onClick={() => setBg(mode)}
                        className={`group relative h-16 rounded-xl border overflow-hidden transition-all cursor-pointer ${
                          active
                            ? 'border-amber-500 shadow-md'
                            : 'border-white/5 hover:border-white/15'
                        }`}
                      >
                        <span className={`absolute inset-0 ${bgPreviewClass[mode]}`} />
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span
                            className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                              active ? 'bg-amber-500 text-neutral-950' : 'bg-neutral-950/60 text-neutral-300'
                            }`}
                          >
                            {t(`settings.bg.${mode}`, lang)}
                          </span>
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
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <Eye className="h-4 w-4 text-neutral-400 shrink-0" />
                    <div className="text-left min-w-0">
                      <div className="text-xs font-bold text-neutral-200 truncate">
                        {t('settings.reduceMotion', lang)}
                      </div>
                      <div className="text-[10px] text-neutral-500 truncate">
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

                {/* Week change badges */}
                <button
                  onClick={() => setShowWeekBadges(!showWeekBadges)}
                  role="switch"
                  aria-checked={showWeekBadges}
                  className="w-full flex items-center justify-between gap-3 p-3.5 rounded-xl border border-white/5 bg-neutral-900/30 hover:bg-neutral-900/50 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <Zap className="h-4 w-4 text-neutral-400 shrink-0" />
                    <div className="text-left min-w-0">
                      <div className="text-xs font-bold text-neutral-200 truncate">
                        {t('settings.weekBadges', lang)}
                      </div>
                      <div className="text-[10px] text-neutral-500 truncate">
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
