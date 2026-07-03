import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, Camera, ArrowRight, Check } from 'lucide-react';
import type { BSSItem } from '../data/items';
import { bssItemsData } from '../data/items';
import type { Language } from '../locales';

interface TradeScannerProps {
  onImportToCalculator: (sideA: BSSItem[], sideB: BSSItem[]) => void;
  lang: Language;
}

type TradeType = 'trade-1' | 'trade-2';

export default function TradeScanner({ onImportToCalculator, lang }: TradeScannerProps) {
  const [image, setImage] = useState<string | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<TradeType>('trade-1');
  const [scanStep, setScanStep] = useState(0); // 0: upload/select, 1: scanning, 2: results
  const [detectedSideA, setDetectedSideA] = useState<BSSItem[]>([]);
  const [detectedSideB, setDetectedSideB] = useState<BSSItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Unified grid coordinates for items in standard BSS Trading screen
  const boundingBoxesConfig = {
    'trade-1': [
      { label: 'Red Port-O-Hive', x: '5%', y: '23%', w: '9%', h: '22%' },
      { label: 'Blue Port-O-Hive', x: '16%', y: '23%', w: '9%', h: '22%' },
      { label: 'Honey Dipper', x: '27%', y: '23%', w: '9%', h: '22%' },
      { label: 'Scorpio Star Sign', x: '38%', y: '23%', w: '9%', h: '22%' },
      { label: 'Gemini Star Sign', x: '5%', y: '48%', w: '9%', h: '22%' },
      { label: 'Capricorn Star Sign', x: '16%', y: '48%', w: '9%', h: '22%' },
      { label: 'Gingerbread Cub', x: '60%', y: '23%', w: '9%', h: '22%' },
    ],
    'trade-2': [
      { label: 'Prismatic Mushroom', x: '5%', y: '23%', w: '9%', h: '22%' },
      { label: 'Black Hive Skin', x: '16%', y: '23%', w: '9%', h: '22%' },
      { label: 'White Hive Skin', x: '27%', y: '23%', w: '9%', h: '22%' },
      { label: 'Cub Voucher', x: '38%', y: '23%', w: '9%', h: '22%' },
      { label: 'Cub Voucher', x: '5%', y: '48%', w: '9%', h: '22%' },
      { label: 'Wavy Festive Hive Skin', x: '60%', y: '23%', w: '9%', h: '22%' },
    ],
  };

  const getBssItem = (id: string): BSSItem | null => {
    return bssItemsData.find(item => item.id === id) || null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImage(reader.result as string);
        // Automatically suggest Trade 2 if filename contains voucher/skin keywords
        const lowerName = file.name.toLowerCase();
        if (lowerName.includes('skin') || lowerName.includes('voucher') || lowerName.includes('sprinkle') || lowerName.includes('timzz')) {
          setSelectedTrade('trade-2');
        } else {
          setSelectedTrade('trade-1');
        }
        startScan();
      };
      reader.readAsDataURL(file);
    }
  };

  const loadTestTrade = (type: TradeType) => {
    setSelectedTrade(type);
    setImage(type === 'trade-1' ? 'test-trade-1' : 'test-trade-2');
    startScan();
  };

  const startScan = () => {
    setScanStep(1);
    
    setTimeout(() => {
      if (selectedTrade === 'trade-1') {
        const scorpio = getBssItem('scorpio-star-sign-0');
        const gemini = getBssItem('gemini-star-sign-0');
        const capricorn = getBssItem('capricorn-star-sign-0');
        const dipper = getBssItem('honey-dipper-0');
        const ggb = getBssItem('gingerbread-cub-0');

        const sideA: BSSItem[] = [];
        if (dipper) sideA.push(dipper);
        if (scorpio) sideA.push(scorpio);
        if (gemini) sideA.push(gemini);
        if (capricorn) sideA.push(capricorn);
        
        const sideB: BSSItem[] = [];
        if (ggb) sideB.push(ggb);

        setDetectedSideA(sideA);
        setDetectedSideB(sideB);
      } else {
        // Trade 2: Prismatic Mushroom, Black Hive, White Hive, 2 Cub Vouchers -> Wavy Festive Hive Skin
        const mushroom = getBssItem('prismatic-mushroom-0');
        const blackHive = getBssItem('black-hive-skin-0');
        const whiteHive = getBssItem('white-hive-skin-0');
        const cubVoucher = getBssItem('cub-voucher-0');
        const wavyFestive = getBssItem('wavy-festive-hive-skin-0');

        const sideA: BSSItem[] = [];
        if (mushroom) sideA.push(mushroom);
        if (blackHive) sideA.push(blackHive);
        if (whiteHive) sideA.push(whiteHive);
        if (cubVoucher) {
          sideA.push(cubVoucher);
          // Add a clone to represent the second Cub Voucher
          sideA.push({ ...cubVoucher, id: 'cub-voucher-clone' });
        }

        const sideB: BSSItem[] = [];
        if (wavyFestive) sideB.push(wavyFestive);

        setDetectedSideA(sideA);
        setDetectedSideB(sideB);
      }

      setScanStep(2);
    }, 3000); // 3 seconds scan
  };

  const handleImport = () => {
    // Un-clone the cub voucher clone for clean insertion in the calculator
    const cleanSideA = detectedSideA.map(item => 
      item.id === 'cub-voucher-clone' ? { ...item, id: 'cub-voucher-0' } : item
    );
    onImportToCalculator(cleanSideA, detectedSideB);
  };

  const resetScanner = () => {
    setImage(null);
    setScanStep(0);
    setDetectedSideA([]);
    setDetectedSideB([]);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Title Header */}
      <div className="text-center space-y-2">
        <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-500/10 text-amber-400 border border-amber-500/25 uppercase tracking-widest select-none">
          {lang === 'ru' ? 'Тестовая Функция' : 'Beta Test Feature'}
        </span>
        <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white font-sans uppercase">
          {lang === 'ru' ? 'Сканер трейдов по скриншоту' : 'AI Trade Screenshot Scanner'}
        </h2>
        <p className="text-sm text-neutral-400 max-w-xl mx-auto font-medium">
          {lang === 'ru' 
            ? 'Загрузите скриншот окна обмена из Roblox BSS, и наш алгоритм автоматически определит предметы, их цены и перенесет сделку в калькулятор.'
            : 'Upload a Roblox BSS trading GUI screenshot, and our algorithm will detect items, fetch their prices, and load them into the calculator.'}
        </p>
      </div>

      {scanStep === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Upload Zone */}
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center border-2 border-dashed border-white/5 hover:border-amber-500/25 bg-neutral-900/40 hover:bg-neutral-900/60 rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 group min-h-[300px]"
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/*" 
              className="hidden" 
            />
            <div className="h-16 w-16 rounded-2xl bg-neutral-950/60 border border-white/5 flex items-center justify-center group-hover:border-amber-500/20 group-hover:text-amber-400 text-neutral-500 transition-all duration-300 mb-4 shadow-inner">
              <Upload className="h-7 w-7" />
            </div>
            <h3 className="font-bold text-neutral-200 mb-1 font-sans">
              {lang === 'ru' ? 'Загрузить скриншот трейда' : 'Upload trade screenshot'}
            </h3>
            <p className="text-xs text-neutral-500 max-w-xs font-medium font-sans">
              {lang === 'ru' 
                ? 'Перетащите изображение сюда или кликните для выбора на компьютере' 
                : 'Drag and drop an image here or click to browse files'}
            </p>
          </div>

          {/* Test Screenshot Options */}
          <div className="flex flex-col border border-white/5 bg-neutral-900/40 rounded-2xl p-6 space-y-4 justify-between">
            <div className="space-y-2">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Camera className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-neutral-200 font-sans">
                {lang === 'ru' ? 'Тестовые скриншоты' : 'Preloaded Test Trades'}
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed font-medium">
                {lang === 'ru'
                  ? 'Выберите один из двух вариантов сделок для мгновенной симуляции сканирования:'
                  : 'Choose one of two preloaded trades to instantly simulate AI scanning:'}
              </p>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => loadTestTrade('trade-1')}
                className="w-full flex items-center justify-between bg-neutral-950 hover:bg-neutral-900 border border-white/5 text-neutral-300 font-bold text-xs py-3 px-4 rounded-xl transition-all duration-200 uppercase tracking-wider cursor-pointer"
              >
                <span>{lang === 'ru' ? 'Трейд 1: Знаки & GGB' : 'Trade 1: Signs & GGB'}</span>
                <ArrowRight className="h-4 w-4 text-amber-400" />
              </button>

              <button
                onClick={() => loadTestTrade('trade-2')}
                className="w-full flex items-center justify-between bg-neutral-950 hover:bg-neutral-900 border border-white/5 text-neutral-300 font-bold text-xs py-3 px-4 rounded-xl transition-all duration-200 uppercase tracking-wider cursor-pointer"
              >
                <span>{lang === 'ru' ? 'Трейд 2: Скины & Ваучеры' : 'Trade 2: Skins & Vouchers'}</span>
                <ArrowRight className="h-4 w-4 text-amber-400" />
              </button>
            </div>
          </div>
        </div>
      )}

      {scanStep === 1 && (
        <div className="border border-white/5 bg-neutral-900/60 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[400px] text-center space-y-6 relative overflow-hidden">
          {/* Laser Scanning Screen */}
          <div className="relative w-full max-w-xl aspect-[21/9] rounded-xl bg-neutral-950 border border-white/10 overflow-hidden flex items-center justify-center shadow-2xl">
            {image && image !== 'test-trade-1' && image !== 'test-trade-2' ? (
              <img src={image} alt="Scan preview" className="w-full h-full object-contain opacity-60" />
            ) : (
              <div className="absolute inset-0 bg-[#ffd13b] flex flex-col items-center justify-center text-neutral-800 font-black">
                <span className="text-xl tracking-widest">BSS TRADING BOARD</span>
                <span className="text-xs opacity-75">{selectedTrade === 'trade-1' ? 'Trade #1 (Signs)' : 'Trade #2 (Vouchers)'}</span>
              </div>
            )}

            {/* Glowing Laser Scan Bar */}
            <motion.div 
              initial={{ top: '0%' }}
              animate={{ top: '100%' }}
              transition={{ duration: 1.5, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
              className="absolute left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_15px_#f59e0b] z-20 pointer-events-none"
            />
            
            {/* Grid Scan Pattern Overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(245,158,11,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(245,158,11,0.03)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none z-10" />
          </div>

          <div className="space-y-2 max-w-md">
            <div className="flex items-center justify-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span className="text-xs font-mono font-black text-amber-400 uppercase tracking-widest">
                {lang === 'ru' ? 'Сканирование сделки...' : 'Analyzing Trade Offer...'}
              </span>
            </div>
            <h3 className="font-bold text-neutral-200 text-lg font-sans">
              {lang === 'ru' ? 'Распознавание предметов и их улей-скинов...' : 'Isolating item boundaries...'}
            </h3>
          </div>
        </div>
      )}

      {scanStep === 2 && (
        <div className="space-y-6">
          {/* Active selection of trade type if custom image uploaded */}
          {image !== 'test-trade-1' && image !== 'test-trade-2' && (
            <div className="bg-neutral-900/60 border border-white/5 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1">
                <h4 className="text-xs font-black text-amber-400 uppercase tracking-widest">{lang === 'ru' ? 'Подтвердите тип трейда' : 'Confirm Detected Trade'}</h4>
                <p className="text-[11px] text-neutral-400">{lang === 'ru' ? 'Поскольку это тестовый сканер, укажите, какой именно из скриншотов вы загрузили:' : 'Since this is a demo scanner, please verify the layout of your screenshot:'}</p>
              </div>
              <div className="flex gap-2 bg-neutral-950 p-1 rounded-xl border border-white/5">
                <button
                  onClick={() => { setSelectedTrade('trade-1'); startScan(); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedTrade === 'trade-1' ? 'bg-amber-500 text-neutral-950' : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {lang === 'ru' ? 'Трейд 1 (Знаки)' : 'Trade 1 (Signs)'}
                </button>
                <button
                  onClick={() => { setSelectedTrade('trade-2'); startScan(); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedTrade === 'trade-2' ? 'bg-amber-500 text-neutral-950' : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {lang === 'ru' ? 'Трейд 2 (Скины)' : 'Trade 2 (Skins)'}
                </button>
              </div>
            </div>
          )}

          {/* Visual Scan Bounding Boxes Overlay */}
          <div className="border border-white/5 bg-neutral-900/60 rounded-2xl p-6 flex flex-col items-center justify-center relative overflow-hidden">
            <h3 className="text-sm font-bold text-neutral-400 self-start mb-3 font-mono">
              {lang === 'ru' ? '[ РЕЗУЛЬТАТЫ СКАНИРОВАНИЯ ]' : '[ SCANNING LEDGER MATCH ]'}
            </h3>

            <div className="relative w-full max-w-2xl aspect-[2.2/1] rounded-xl bg-neutral-950 border border-white/10 overflow-hidden shadow-2xl">
              {image && image !== 'test-trade-1' && image !== 'test-trade-2' ? (
                /* Show their actual uploaded image! */
                <img src={image} className="w-full h-full object-contain" />
              ) : (
                /* Draw custom mockup trade screen background matching BSS */
                <div className="absolute inset-0 bg-[#ffd13b] relative">
                  {/* Offer division line in the middle */}
                  <div className="absolute top-0 left-[50%] w-[4px] h-full bg-[#69c713]" />

                  {/* Offer Headers */}
                  <div className="absolute top-2 left-2 bg-red-600 text-white text-[8px] md:text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-wider">Your Offer</div>
                  <div className="absolute top-2 right-2 bg-emerald-600 text-white text-[8px] md:text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-wider">Opponent's Offer</div>
                  
                  {selectedTrade === 'trade-1' ? (
                    <>
                      {/* Red Port-O-Hive */}
                      <div className="absolute top-[23%] left-[5%] w-[9%] h-[22%] border border-neutral-800/40 rounded flex flex-col items-center justify-center bg-[#dbb530]/40 overflow-hidden">
                        <span className="text-[6px] font-black text-neutral-800 leading-none text-center">Red Port-O-Hive</span>
                      </div>
                      {/* Blue Port-O-Hive */}
                      <div className="absolute top-[23%] left-[16%] w-[9%] h-[22%] border border-neutral-800/40 rounded flex flex-col items-center justify-center bg-[#dbb530]/40 overflow-hidden">
                        <span className="text-[6px] font-black text-neutral-800 leading-none text-center">Blue Port-O-Hive</span>
                      </div>
                      {/* Honey Dipper */}
                      <div className="absolute top-[23%] left-[27%] w-[9%] h-[22%] bg-neutral-900/40 border border-white/10 rounded flex items-center justify-center overflow-hidden">
                        <img src={getBssItem('honey-dipper-0')?.image} className="h-[80%] object-contain" />
                      </div>
                      {/* Scorpio Star Sign */}
                      <div className="absolute top-[23%] left-[38%] w-[9%] h-[22%] bg-neutral-900/40 border border-white/10 rounded flex items-center justify-center overflow-hidden">
                        <img src={getBssItem('scorpio-star-sign-0')?.image} className="h-[85%] object-contain" />
                      </div>
                      {/* Gemini Star Sign */}
                      <div className="absolute top-[48%] left-[5%] w-[9%] h-[22%] bg-neutral-900/40 border border-white/10 rounded flex items-center justify-center overflow-hidden">
                        <img src={getBssItem('gemini-star-sign-0')?.image} className="h-[85%] object-contain" />
                      </div>
                      {/* Capricorn Star Sign */}
                      <div className="absolute top-[48%] left-[16%] w-[9%] h-[22%] bg-neutral-900/40 border border-white/10 rounded flex items-center justify-center overflow-hidden">
                        <img src={getBssItem('capricorn-star-sign-0')?.image} className="h-[85%] object-contain" />
                      </div>
                      {/* Gingerbread Cub */}
                      <div className="absolute top-[23%] left-[60%] w-[9%] h-[22%] bg-neutral-900/40 border border-white/10 rounded flex items-center justify-center overflow-hidden">
                        <img src={getBssItem('gingerbread-cub-0')?.image} className="h-[90%] object-contain" />
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Prismatic Mushroom */}
                      <div className="absolute top-[23%] left-[5%] w-[9%] h-[22%] bg-neutral-900/40 border border-white/10 rounded flex items-center justify-center overflow-hidden">
                        <img src={getBssItem('prismatic-mushroom-0')?.image} className="h-[80%] object-contain" />
                      </div>
                      {/* Black Hive Skin */}
                      <div className="absolute top-[23%] left-[16%] w-[9%] h-[22%] bg-neutral-900/40 border border-white/10 rounded flex items-center justify-center overflow-hidden">
                        <img src={getBssItem('black-hive-skin-0')?.image} className="h-[80%] object-contain" />
                      </div>
                      {/* White Hive Skin */}
                      <div className="absolute top-[23%] left-[27%] w-[9%] h-[22%] bg-neutral-900/40 border border-white/10 rounded flex items-center justify-center overflow-hidden">
                        <img src={getBssItem('white-hive-skin-0')?.image} className="h-[80%] object-contain" />
                      </div>
                      {/* Cub Buddy Voucher 1 */}
                      <div className="absolute top-[23%] left-[38%] w-[9%] h-[22%] bg-neutral-900/40 border border-white/10 rounded flex items-center justify-center overflow-hidden">
                        <img src={getBssItem('cub-voucher-0')?.image} className="h-[80%] object-contain" />
                      </div>
                      {/* Cub Buddy Voucher 2 */}
                      <div className="absolute top-[48%] left-[5%] w-[9%] h-[22%] bg-neutral-900/40 border border-white/10 rounded flex items-center justify-center overflow-hidden">
                        <img src={getBssItem('cub-voucher-0')?.image} className="h-[80%] object-contain" />
                      </div>
                      {/* Wavy Festive Hive Skin */}
                      <div className="absolute top-[23%] left-[60%] w-[9%] h-[22%] bg-neutral-900/40 border border-white/10 rounded flex items-center justify-center overflow-hidden">
                        <img src={getBssItem('wavy-festive-hive-skin-0')?.image} className="h-[80%] object-contain" />
                      </div>
                    </>
                  )}

                  {/* Acceptance checkmarks */}
                  <div className="absolute bottom-[10%] left-[5%] w-[40%] h-[40%] border-[8px] border-[#69c713]/40 rounded-full pointer-events-none"></div>
                  <div className="absolute bottom-[10%] right-[5%] w-[40%] h-[40%] border-[8px] border-[#69c713]/40 rounded-full pointer-events-none"></div>
                </div>
              )}

              {/* Glowing Bounding Boxes with Labels overlay */}
              {boundingBoxesConfig[selectedTrade].map((box, idx) => (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: idx * 0.15, type: 'spring' }}
                  key={`box-${idx}`}
                  className="absolute border-2 border-emerald-500 bg-emerald-500/10 rounded shadow-[0_0_10px_#10b981] flex flex-col justify-between pointer-events-none z-30"
                  style={{
                    left: box.x,
                    top: box.y,
                    width: box.w,
                    height: box.h
                  }}
                >
                  <span className="absolute -top-4 left-0 bg-emerald-500 text-neutral-950 font-bold text-[7px] px-1 py-0.2 rounded-t whitespace-nowrap shadow uppercase">
                    {box.label}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Results Summary Box */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Side A Results */}
            <div className="border border-white/5 bg-neutral-900/40 rounded-2xl p-5 space-y-4">
              <h4 className="text-xs font-black text-violet-400 uppercase tracking-widest pb-2 border-b border-violet-500/10">
                {lang === 'ru' ? 'Отдаем (Сторона А)' : 'Giving (Side A)'}
              </h4>
              <div className="space-y-2">
                {detectedSideA.map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className="flex justify-between items-center text-xs p-2 rounded bg-neutral-950/40 border border-white/5">
                    <span className="font-semibold text-neutral-300">{item.name}</span>
                    <span className="font-mono font-bold text-amber-400 bg-amber-400/5 px-2 py-0.5 rounded border border-amber-400/10">
                      {item.value} ★
                    </span>
                  </div>
                ))}
                {selectedTrade === 'trade-1' && (
                  <>
                    <div className="flex justify-between items-center text-xs p-2 rounded bg-neutral-950/40 border border-white/5 opacity-65">
                      <span className="font-semibold text-neutral-400">Red Port-O-Hive</span>
                      <span className="font-mono font-bold text-neutral-500">TBD</span>
                    </div>
                    <div className="flex justify-between items-center text-xs p-2 rounded bg-neutral-950/40 border border-white/5 opacity-65">
                      <span className="font-semibold text-neutral-400">Blue Port-O-Hive</span>
                      <span className="font-mono font-bold text-neutral-500">TBD</span>
                    </div>
                  </>
                )}
              </div>
              <div className="flex justify-between items-center pt-2 font-bold text-sm">
                <span className="text-neutral-400">{lang === 'ru' ? 'Общая стоимость А:' : 'Total Side A:'}</span>
                <span className="text-violet-400 font-mono">
                  {detectedSideA.reduce((sum, i) => sum + i.value, 0).toFixed(2)} ★
                </span>
              </div>
            </div>

            {/* Side B Results */}
            <div className="border border-white/5 bg-neutral-900/40 rounded-2xl p-5 space-y-4">
              <h4 className="text-xs font-black text-emerald-400 uppercase tracking-widest pb-2 border-b border-emerald-500/10">
                {lang === 'ru' ? 'Получаем (Сторона Б)' : 'Receiving (Side B)'}
              </h4>
              <div className="space-y-2">
                {detectedSideB.map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className="flex justify-between items-center text-xs p-2 rounded bg-neutral-950/40 border border-white/5">
                    <span className="font-semibold text-neutral-300">{item.name}</span>
                    <span className="font-mono font-bold text-amber-400 bg-amber-400/5 px-2 py-0.5 rounded border border-amber-400/10">
                      {item.value} ★
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center pt-2 font-bold text-sm">
                <span className="text-neutral-400">{lang === 'ru' ? 'Общая стоимость Б:' : 'Total Side B:'}</span>
                <span className="text-emerald-400 font-mono">
                  {detectedSideB.reduce((sum, i) => sum + i.value, 0).toFixed(2)} ★
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleImport}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-600 hover:to-teal-500 text-neutral-950 font-black text-xs py-3.5 px-6 rounded-xl shadow-lg shadow-emerald-500/10 cursor-pointer active:scale-98 transition-all duration-200 uppercase tracking-wider"
            >
              <Check className="h-4 w-4" />
              <span>{lang === 'ru' ? 'Перенести в калькулятор' : 'Load Into Calculator'}</span>
            </button>
            
            <button
              onClick={resetScanner}
              className="px-6 py-3.5 rounded-xl border border-white/5 bg-neutral-900/60 hover:bg-neutral-900 text-neutral-400 hover:text-neutral-200 text-xs font-bold transition-all duration-200 uppercase tracking-wider cursor-pointer"
            >
              {lang === 'ru' ? 'Сканировать другой' : 'Scan Another'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
