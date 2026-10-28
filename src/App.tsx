import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { Filter, SlidersHorizontal, AlertCircle, Search } from 'lucide-react';
import Navbar from './components/Navbar';
import Home from './components/Home';
import ItemCard from './components/ItemCard';
import TradeCalculator from './components/TradeCalculator';
import ItemDetailModal from './components/ItemDetailModal';
import CommandMenu from './components/CommandMenu';
import AuthorsModal from './components/AuthorsModal';
import BeequipsPage from './components/BeequipsPage';
import ErrorBoundary from './components/ErrorBoundary';
import SettingsModal from './components/SettingsModal';
import type { BgMode, Theme } from './components/SettingsModal';
import type { BSSItem } from './data/items';
import { useItems } from './data/itemsStore';
import type { Language } from './locales';
import { t, translateCategory } from './locales';
import { transliterate } from './components/BeequipsPage';
import { slugFromPath } from './itemSlug';

type CategoryType = string;
type SortType = 'value-desc' | 'value-asc' | 'demand-desc' | 'name-asc';
type TabType = 'home' | 'catalog' | 'calculator' | 'beequips';

export default function App() {
  const items = useItems();

  // The item data is fetched at runtime, so nothing can render before it
  // arrives. A short skeleton avoids a flash of empty UI.
  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-amber-500/25 border-t-amber-500 animate-spin" />
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-600">
            BSS Index
          </span>
        </div>
      </div>
    );
  }

  return <BssApp items={items} />;
}

function BssApp({ items }: { items: BSSItem[] }) {
  const [sideA, setSideA] = useState<BSSItem[]>([]);
  const [sideB, setSideB] = useState<BSSItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<BSSItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('Все');
  const [sortingOption, setSortingOption] = useState<SortType>('value-desc');
  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState(false);
  const [isAuthorsModalOpen, setIsAuthorsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string; side: 'A' | 'B' | null }>({ show: false, message: '', side: null });

  const [lang, setLangState] = useState<Language>(() => {
    // /ru/... pages are the Russian mirror, so they win over the stored default.
    if (window.location.pathname === '/ru' || window.location.pathname.startsWith('/ru/')) {
      return 'ru';
    }
    const saved = localStorage.getItem('bss_lang') as Language;
    return saved === 'ru' || saved === 'en' ? saved : 'en';
  });

  const setLang = (newLang: Language) => {
    localStorage.setItem('bss_lang', newLang);
    setLangState(newLang);
  };
  const [activeTab, setActiveTab] = useState<TabType>('home');

  // Appearance settings
  const [theme, setThemeState] = useState<Theme>(() => {
    return localStorage.getItem('bss_theme') === 'light' ? 'light' : 'dark';
  });

  const [bg, setBgState] = useState<BgMode>(() => {
    const saved = localStorage.getItem('bss_bg') as BgMode;
    const valid: BgMode[] = ['dots', 'grid', 'solid', 'aurora', 'halloween'];
    return valid.includes(saved) ? saved : 'grid';
  });

  const [reduceMotion, setReduceMotionState] = useState<boolean>(() => {
    return localStorage.getItem('bss_motion') === 'reduced';
  });

  const [showWeekBadges, setShowWeekBadgesState] = useState<boolean>(() => {
    return localStorage.getItem('bss_badges') !== 'hidden';
  });

  // These two used to be the raw state setters, so the choices were lost on
  // every reload — the toggle looked like it worked and then forgot.
  const setReduceMotion = (value: boolean) => {
    localStorage.setItem('bss_motion', value ? 'reduced' : 'full');
    setReduceMotionState(value);
  };

  const setShowWeekBadges = (value: boolean) => {
    localStorage.setItem('bss_badges', value ? 'shown' : 'hidden');
    setShowWeekBadgesState(value);
  };

  const setTheme = (t: Theme) => {
    localStorage.setItem('bss_theme', t);
    setThemeState(t);
  };

  const setBg = (newBg: BgMode) => {
    localStorage.setItem('bss_bg', newBg);
    setBgState(newBg);
  };

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('light', theme === 'light');
    // The prerendered block on /item/<slug> pages sits outside #app, so it reads
    // this attribute instead of the app's own bgmode-* class.
    root.setAttribute('data-bsbg', bg);
    // The "Reduce motion" setting: framer-motion is handled by <MotionConfig>,
    // this attribute covers the plain CSS animations.
    root.setAttribute('data-motion', reduceMotion ? 'reduced' : 'full');
  }, [theme, bg, reduceMotion]);

  // /item/<slug> pages are standalone: the prerendered block above the app is the
  // page. We deliberately do NOT auto-open the item modal here — it would cover
  // the very content the visitor came for. The catalog tab is set so the app
  // below lands on the listing rather than the home screen.
  useEffect(() => {
    if (slugFromPath(window.location.pathname)) {
      setActiveTab('catalog');
    }
  }, []);

  // Restore a shared trade from ?trade=<sideA ids>|<sideB ids>, falling back to
  // the last saved trade.
  //
  // These MUST live in one effect: previously the URL parser and the storage
  // rehydration were separate mount effects, so the storage pass ran with the
  // pre-parse state and overwrote whatever the link had just loaded.
  const tradeRestored = useRef(false);
  useEffect(() => {
    if (tradeRestored.current) return;
    tradeRestored.current = true;

    const byId = new Map(items.map((i) => [i.id, i]));
    const resolve = (ids: string) =>
      ids
        .split(',')
        .map((id) => byId.get(id))
        .filter((i): i is BSSItem => Boolean(i));

    const raw = new URLSearchParams(window.location.search).get('trade');
    let a: BSSItem[] = [];
    let b: BSSItem[] = [];

    if (raw) {
      const [aIds, bIds] = raw.split('|');
      a = resolve(aIds || '');
      b = resolve(bIds || '');
    } else {
      try {
        const read = (key: string) => {
          const parsed: string[] = JSON.parse(localStorage.getItem(key) || '[]');
          return resolve(Array.isArray(parsed) ? parsed.join(',') : '');
        };
        a = read('bss-trade-sideA');
        b = read('bss-trade-sideB');
      } catch {
        /* malformed storage — start empty */
      }
    }

    if (a.length === 0 && b.length === 0) return;
    setSideA(a);
    setSideB(b);
    setActiveTab('calculator');
    // The data arrives at runtime, so this effect only ever runs once the
    // items are actually available (BssApp is not mounted before then).
  }, [items]);

  // Persist the trade so a refresh does not lose it.
  useEffect(() => {
    try {
      localStorage.setItem('bss-trade-sideA', JSON.stringify(sideA.map((i) => i.id)));
      localStorage.setItem('bss-trade-sideB', JSON.stringify(sideB.map((i) => i.id)));
    } catch {
      /* private mode / quota — sharing still works */
    }
  }, [sideA, sideB]);

  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => {
        setToast(prev => ({ ...prev, show: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);

  const handleAddToSideA = (item: BSSItem) => {
    const updated = [...sideA, item];
    setSideA(updated);
    setToast({ show: true, message: item.name, side: 'A' });
  };

  const handleAddToSideB = (item: BSSItem) => {
    const updated = [...sideB, item];
    setSideB(updated);
    setToast({ show: true, message: item.name, side: 'B' });
  };

  const handleRemoveFromSideA = (idx: number) => {
    const updated = sideA.filter((_, i) => i !== idx);
    setSideA(updated);
  };

  const handleRemoveFromSideB = (idx: number) => {
    const updated = sideB.filter((_, i) => i !== idx);
    setSideB(updated);
  };

  const handleClearTrade = () => {
    setSideA([]);
    setSideB([]);
    localStorage.removeItem('bss-trade-sideA');
    localStorage.removeItem('bss-trade-sideB');
  };

  // Categories list dynamically compiled from dataset
  const categories: CategoryType[] = [
    'Все',
    ...Array.from(new Set(items.map(item => item.category).filter(c => c !== 'Биквипы')))
  ];

  // Demand ranking helper for sorting
  const demandRank: Record<string, number> = {
    'Хайп': 4,
    'Высокий': 3,
    'Средний': 2,
    'Низкий': 1,
  };

  // Filter & Sort Items
  const processedItems = items
    .filter(item => {
      // Exclude Beequips from the main catalog since they have their own tab
      if (item.category === 'Биквипы') return false;

      // Category filter
      if (selectedCategory !== 'Все' && item.category !== selectedCategory) {
        return false;
      }
      // Search filter
      const query = searchQuery.toLowerCase();
      const transQ = transliterate(query);
      return (
        item.name.toLowerCase().includes(query) ||
        item.englishName.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(transQ) ||
        item.englishName.toLowerCase().includes(transQ) ||
        item.category.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      switch (sortingOption) {
        case 'value-asc':
          return a.value - b.value;
        case 'demand-desc':
          return demandRank[b.demand] - demandRank[a.demand];
        case 'name-asc':
          return a.name.localeCompare(b.name, 'ru');
        case 'value-desc':
        default:
          return b.value - a.value;
      }
    });

  return (
    <ErrorBoundary>
    <MotionConfig reducedMotion={reduceMotion ? 'always' : 'user'}>
    <div className={`min-h-screen bg-[#0b0f19] text-neutral-100 font-sans relative antialiased bgmode-${bg}`}>

      {/* Release banner */}
      <div className="bg-gradient-to-r from-amber-500/80 to-yellow-600/80 text-neutral-950 text-[10px] font-extrabold py-1.5 px-4 text-center tracking-wider uppercase select-none flex items-center justify-center gap-2 shadow-md border-b border-amber-500/10 flex-wrap">
        <span className="bg-neutral-950 text-amber-500 px-1.5 py-0.5 rounded text-[8px] font-black border border-amber-500/20 tracking-normal inline-block">
          v{__APP_VERSION__}
        </span>
        <span className="opacity-95">
          {lang === 'ru' ? 'Открыть поиск:' : 'Open search:'}{' '}
          <kbd className="bg-neutral-950/20 px-1 py-0.5 rounded font-mono border border-neutral-950/10">Ctrl + K</kbd>
        </span>
      </div>

      <Navbar
        onSearchClick={() => setIsCommandMenuOpen(true)}
        onAuthorsClick={() => setIsAuthorsModalOpen(true)}
        onSettingsClick={() => setIsSettingsOpen(true)}
        lang={lang}
        setLang={setLang}
        onLogoClick={() => setActiveTab('home')}
      />

      <ErrorBoundary fallback={null}>
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-10 space-y-12">
        {/* Tabs Navigation */}
        <div className="flex items-center justify-center gap-2 md:gap-4 border-b border-white/5 pb-6 select-none">
          <button
            onClick={() => setActiveTab('home')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'home' 
                ? 'bg-amber-500 text-neutral-950 shadow-md' 
                : 'bg-neutral-900/40 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60 border border-white/5'
            }`}
          >
            {t('nav.tab.home', lang)}
          </button>
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'catalog' 
                ? 'bg-amber-500 text-neutral-950 shadow-md' 
                : 'bg-neutral-900/40 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60 border border-white/5'
            }`}
          >
            {t('nav.tab.catalog', lang)}
          </button>
          <button
            onClick={() => setActiveTab('calculator')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'calculator' 
                ? 'bg-amber-500 text-neutral-950 shadow-md' 
                : 'bg-neutral-900/40 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60 border border-white/5'
            }`}
          >
            {t('nav.tab.calculator', lang)}
            {(sideA.length > 0 || sideB.length > 0) && (
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${
                activeTab === 'calculator' ? 'bg-neutral-950/20' : 'bg-amber-500/20 text-amber-400'
              }`}>
                {sideA.length + sideB.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('beequips')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'beequips' 
                ? 'bg-amber-500 text-neutral-950 shadow-md' 
                : 'bg-neutral-900/40 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60 border border-white/5'
            }`}
          >
            {t('nav.tab.beequips', lang)}
          </button>
        </div>

        {activeTab === 'home' && (
          <Home
            onNavigate={setActiveTab}
            onSearchClick={() => {
              // open command menu
            }}
            lang={lang}
          />
        )}

        {activeTab === 'calculator' && (
          <section id="trade-calculator-section" className="animate-in fade-in duration-500">
            <TradeCalculator
              sideA={sideA}
              sideB={sideB}
              onAddToSideA={handleAddToSideA}
              onAddToSideB={handleAddToSideB}
              onRemoveFromSideA={handleRemoveFromSideA}
              onRemoveFromSideB={handleRemoveFromSideB}
              onClearTrade={handleClearTrade}
              lang={lang}
            />
          </section>
        )}

        {activeTab === 'beequips' && (
          <BeequipsPage
            lang={lang}
            onAddToSideA={handleAddToSideA}
            onAddToSideB={handleAddToSideB}
            onSelectItem={setSelectedItem}
          />
        )}

        {activeTab === 'catalog' && (
          <section className="space-y-6 animate-in fade-in duration-500">
            
            {/* Controls Bar: Search, Category Tabs, Sorting */}
            <div className="space-y-4">
              
              {/* Top controls: Search & Sort */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Local Search bar */}
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('catalog.search.placeholder', lang)}
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-neutral-900/50 border border-white/5 placeholder-neutral-500 text-xs outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20 text-neutral-100 transition-all"
                  />
                </div>

                {/* Sorting options select */}
                <div className="flex items-center gap-2 select-none self-end md:self-auto">
                  <SlidersHorizontal className="h-4 w-4 text-neutral-500" />
                  <span className="text-xs text-neutral-400 font-bold">{t('catalog.sort.label', lang)}</span>
                  <select
                    value={sortingOption}
                    onChange={(e) => setSortingOption(e.target.value as SortType)}
                    className="bg-neutral-900/50 border border-white/5 text-xs text-neutral-300 font-semibold py-1.5 px-3 rounded-xl outline-none cursor-pointer hover:border-white/10"
                  >
                    <option value="value-desc">{t('catalog.sort.valDesc', lang)}</option>
                    <option value="value-asc">{t('catalog.sort.valAsc', lang)}</option>
                    <option value="demand-desc">{t('catalog.sort.demDesc', lang)}</option>
                    <option value="name-asc">{t('catalog.sort.nameAsc', lang)}</option>
                  </select>
                </div>
              </div>

              {/* Category tabs */}
              <div className="flex flex-wrap items-center gap-2 border-b border-white/5 pb-4 select-none">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mr-2 flex items-center gap-1">
                  <Filter className="h-3.5 w-3.5 text-neutral-500" /> {t('catalog.filter.label', lang)}
                </span>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-lg border transition-all duration-200 cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-amber-500 border-amber-500 text-neutral-950 font-black shadow-md'
                        : 'bg-neutral-900/40 border-white/5 text-neutral-400 hover:text-neutral-200 hover:border-white/10'
                    }`}
                  >
                    {translateCategory(cat, lang)}
                  </button>
                ))}
              </div>

            </div>

            {/* Cards Grid */}
            <motion.div
              layout
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              <AnimatePresence mode="popLayout">
                {processedItems.length > 0 ? (
                  processedItems.map((item, idx) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      index={idx}
                      onClick={() => setSelectedItem(item)}
                      onAddToSideA={handleAddToSideA}
                      onAddToSideB={handleAddToSideB}
                      lang={lang}
                      searchQuery={searchQuery}
                    />
                  ))
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="col-span-full py-16 text-center text-neutral-500 border border-dashed border-white/5 rounded-2xl"
                  >
                    <AlertCircle className="h-9 w-9 mx-auto opacity-35 mb-2 text-amber-500" />
                    <p className="text-xs font-semibold">{t('catalog.empty', lang)}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

          </section>
        )}
      </main>
      </ErrorBoundary>

      {/* Footer */}
      <footer className="w-full border-t border-white/5 py-10 bg-neutral-950/20 mt-20 select-none">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-6 text-[10px] text-neutral-500">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center">
              <svg className="h-3.5 w-3.5 text-neutral-950" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 2a1 1 0 01.832.445l5 7.5a1 1 0 010 1.11l-5 7.5A1 1 0 0110 19a1 1 0 01-.832-.445l-5-7.5a1 1 0 010-1.11l5-7.5A1 1 0 0110 2zm0 2.443L5.628 10 10 15.557 14.372 10 10 4.443z" />
              </svg>
            </div>
            <span className="font-extrabold tracking-widest text-neutral-400">BSS INDEX</span>
            <span>• {lang === 'ru' ? 'Валют лист стикеров и биквипов Bee Swarm Simulator' : 'Bee Swarm Simulator Sticker & Beequip Value List'}</span>
            <a
              href={lang === 'ru' ? '/ru/items/' : '/items/'}
              className="text-amber-500/80 hover:text-amber-400 font-bold transition-colors no-underline"
            >
              {lang === 'ru' ? 'Все предметы' : 'All items'}
            </a>
            <a
              href="/demo/"
              target="_blank"
              rel="noopener"
              className="text-amber-500/80 hover:text-amber-400 font-bold transition-colors no-underline"
            >
              {lang === 'ru' ? 'Демо API' : 'API demo'}
            </a>
            <a
              href="/api/v1/docs.html"
              target="_blank"
              rel="noopener"
              className="text-amber-500/80 hover:text-amber-400 font-bold transition-colors no-underline"
            >
              API v1
            </a>
            <a
              href="/api/v1/docs.ru.html"
              target="_blank"
              rel="noopener"
              className="text-amber-500/80 hover:text-amber-400 font-bold transition-colors no-underline"
            >
              {lang === 'ru' ? 'API (доки)' : 'API (документация)'}
            </a>
            <a
              href="/api/"
              target="_blank"
              rel="noopener"
              className="text-amber-500/80 hover:text-amber-400 font-bold transition-colors no-underline"
            >
              API
            </a>
          </div>
          <div className="flex flex-col sm:items-end gap-1">
            <p className="flex items-center gap-1">
              © {new Date().getFullYear()} BSS INDEX v{__APP_VERSION__}. {lang === 'ru' ? 'Создано для трейдеров Bee Swarm Simulator.' : 'Created for Bee Swarm Simulator traders.'}
            </p>
            <p className="text-amber-500/80 font-bold flex items-center gap-1">
              {lang === 'ru' ? 'Автор проекта:' : 'Project Author:'} <span className="hover:text-amber-400 transition-colors cursor-pointer underline decoration-dotted" onClick={() => setIsAuthorsModalOpen(true)}>happy goose</span> 🪿
            </p>
          </div>
        </div>
      </footer>

      {/* Deep-Dive Detailed Item Modal Drawer */}
      <ItemDetailModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onAddToSideA={handleAddToSideA}
        onAddToSideB={handleAddToSideB}
        lang={lang}
      />

      {/* Command Spotlight Dialogue search */}
      <CommandMenu
        isOpen={isCommandMenuOpen}
        setIsOpen={setIsCommandMenuOpen}
        onSelectItem={setSelectedItem}
        lang={lang}
      />

      {/* Authors Information Modal */}
      <AuthorsModal
        isOpen={isAuthorsModalOpen}
        onClose={() => setIsAuthorsModalOpen(false)}
        lang={lang}
      />

      {/* Appearance & Behavior Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        lang={lang}
        theme={theme}
        setTheme={setTheme}
        bg={bg}
        setBg={setBg}
        reduceMotion={reduceMotion}
        setReduceMotion={setReduceMotion}
        showWeekBadges={showWeekBadges}
        setShowWeekBadges={setShowWeekBadges}
      />

      {/* Toast Notification */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl border bg-[#0b0f19]/95 backdrop-blur-md shadow-2xl min-w-[280px] max-w-sm pointer-events-auto ${
              toast.side === 'A'
                ? 'border-violet-500/20 shadow-violet-500/10'
                : toast.side === 'B'
                ? 'border-emerald-500/20 shadow-emerald-500/10'
                : 'border-amber-500/20 shadow-amber-500/10'
            }`}
          >
            <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${
              toast.side === 'A'
                ? 'bg-violet-500/10 text-violet-400'
                : toast.side === 'B'
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-amber-500/10 text-amber-400'
            }`}>
              {toast.side === 'A' || toast.side === 'B' ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <Clipboard className="h-5 w-5" />
              )}
            </div>
            <div className="flex-1 text-left">
              <div className="text-xs font-black text-white uppercase tracking-wider">
                {toast.side === 'A'
                  ? (lang === 'ru' ? 'Вы отдаете (Сторона А)' : 'You Give (Side A)')
                  : toast.side === 'B'
                  ? (lang === 'ru' ? 'Вам отдают (Сторона Б)' : 'They Give (Side B)')
                  : lang === 'ru'
                  ? 'Скопировано в буфер обмена!'
                  : 'Link copied to clipboard!'}
              </div>
              <div className="text-[11px] text-neutral-300 font-bold mt-0.5 truncate max-w-[220px]">
                {toast.message}
              </div>
            </div>
            <button
              onClick={() => setToast(prev => ({ ...prev, show: false }))}
              className="text-neutral-500 hover:text-white transition-colors p-1"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </MotionConfig>
    </ErrorBoundary>
  );
}
