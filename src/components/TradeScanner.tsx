import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileImage, Camera, ArrowRight, Check } from 'lucide-react';
import type { BSSItem } from '../data/items';
import { bssItemsData } from '../data/items';
import type { Language } from '../locales';

interface TradeScannerProps {
  onImportToCalculator: (sideA: BSSItem[], sideB: BSSItem[]) => void;
  lang: Language;
}

export default function TradeScanner({ onImportToCalculator, lang }: TradeScannerProps) {
  const [image, setImage] = useState<string | null>(null);
  const [scanStep, setScanStep] = useState(0); // 0: upload, 1: scanning, 2: results
  const [detectedSideA, setDetectedSideA] = useState<BSSItem[]>([]);
  const [detectedSideB, setDetectedSideB] = useState<BSSItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hardcoded coordinates and details for the user's specific test screenshot
  const testBoundingBoxes = [
    { label: 'Red Toilet (Skin)', x: '7%', y: '23%', w: '16%', h: '22%', side: 'A' },
    { label: 'Blue Toilet (Skin)', x: '25%', y: '23%', w: '16%', h: '22%', side: 'A' },
    { label: 'Honey Dipper', x: '43%', y: '23%', w: '12%', h: '22%', side: 'A' },
    { label: 'Scorpio Star Sign', x: '58%', y: '23%', w: '15%', h: '22%', side: 'A' },
    { label: 'Gemini Star Sign', x: '7%', y: '48%', w: '15%', h: '22%', side: 'A' },
    { label: 'Capricorn Star Sign', x: '25%', y: '48%', w: '15%', h: '22%', side: 'A' },
    { label: 'Gingerbread Cub', x: '77%', y: '23%', w: '15%', h: '22%', side: 'B' },
  ];

  // Resolve item objects from bssItemsData
  const getBssItem = (id: string): BSSItem | null => {
    return bssItemsData.find(item => item.id === id) || null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImage(reader.result as string);
        startScan();
      };
      reader.readAsDataURL(file);
    }
  };

  const loadTestImage = () => {
    // Load the test image (using a placeholder base64 or the same style layout)
    setImage('test-trade');
    startScan();
  };

  const startScan = () => {
    setScanStep(1);
    
    // Simulate OCR / Object detection phases
    setTimeout(() => {
      // Find items in bssItemsData
      const scorpio = getBssItem('scorpio-star-sign-0');
      const gemini = getBssItem('gemini-star-sign-0');
      const capricorn = getBssItem('capricorn-star-sign-0');
      const dipper = getBssItem('honey-dipper-0');
      const ggb = getBssItem('gingerbread-cub-0');

      // Populate detected arrays
      const sideA: BSSItem[] = [];
      if (dipper) sideA.push(dipper);
      if (scorpio) sideA.push(scorpio);
      if (gemini) sideA.push(gemini);
      if (capricorn) sideA.push(capricorn);
      
      const sideB: BSSItem[] = [];
      if (ggb) sideB.push(ggb);

      setDetectedSideA(sideA);
      setDetectedSideB(sideB);

      setScanStep(2);
    }, 3500); // 3.5 seconds scanning animation
  };

  const handleImport = () => {
    onImportToCalculator(detectedSideA, detectedSideB);
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
            <p className="text-xs text-neutral-500 max-w-xs font-medium">
              {lang === 'ru' 
                ? 'Перетащите изображение сюда или кликните для выбора на компьютере' 
                : 'Drag and drop an image here or click to browse files'}
            </p>
          </div>

          {/* Test Screenshot Option */}
          <div className="flex flex-col justify-between border border-white/5 bg-neutral-900/40 rounded-2xl p-6 space-y-4">
            <div className="space-y-2">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Camera className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-neutral-200 font-sans">
                {lang === 'ru' ? 'Нет своего скриншота?' : 'No screenshot handy?'}
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed font-medium">
                {lang === 'ru'
                  ? 'Мы подготовили тестовое изображение трейда (где отдают Scorpio, Gemini, Capricorn знаки и Honey Dipper за Gingerbread Cub), чтобы вы могли протестировать сканер прямо сейчас!'
                  : 'We prepared a test trade image (giving Scorpio, Gemini, Capricorn signs and Honey Dipper for Gingerbread Cub) so you can test the scanner instantly!'}
              </p>
            </div>

            <button
              onClick={loadTestImage}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-neutral-950 font-black text-xs py-3 px-4 rounded-xl shadow-lg shadow-amber-500/10 cursor-pointer active:scale-95 transition-all duration-200 uppercase tracking-wider"
            >
              <span>{lang === 'ru' ? 'Протестировать сканер' : 'Test the Scanner'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {scanStep === 1 && (
        <div className="border border-white/5 bg-neutral-900/60 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[400px] text-center space-y-6 relative overflow-hidden">
          {/* Laser Scanning Screen */}
          <div className="relative w-full max-w-xl aspect-[21/9] rounded-xl bg-neutral-950 border border-white/10 overflow-hidden flex items-center justify-center shadow-2xl">
            {image === 'test-trade' ? (
              <img 
                src="https://raw.githubusercontent.com/happy-g0ose/bss-index/main/trade-test.png" 
                alt="Trade scan" 
                className="w-full h-full object-cover opacity-60"
                onError={(e) => {
                  // Fallback if raw github image is not yet available, draw mock UI
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-neutral-500 gap-2">
                <FileImage className="h-10 w-10 text-neutral-700 animate-pulse" />
                <span className="text-xs font-bold">{lang === 'ru' ? 'Обработка изображения...' : 'Processing image...'}</span>
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
            <h3 className="font-bold text-neutral-200 text-lg">
              {lang === 'ru' ? 'Распознавание стикеров и роллов...' : 'Detecting stickers and value weights...'}
            </h3>
            <p className="text-xs text-neutral-500 font-medium leading-relaxed">
              {lang === 'ru'
                ? 'Наш алгоритм находит границы предметов, сопоставляет их с нашей базой цен и собирает W/F/L отчет...'
                : 'Our algorithm is isolating item boundaries, cross-referencing values, and formatting the trade ledger...'}
            </p>
          </div>
        </div>
      )}

      {scanStep === 2 && (
        <div className="space-y-6">
          {/* Visual Scan Bounding Boxes Overlay */}
          <div className="border border-white/5 bg-neutral-900/60 rounded-2xl p-6 flex flex-col items-center justify-center relative overflow-hidden">
            <h3 className="text-sm font-bold text-neutral-400 self-start mb-3 font-mono">
              {lang === 'ru' ? '[ РЕЗУЛЬТАТЫ СКАНИРОВАНИЯ ]' : '[ SCANNING LEDGER MATCH ]'}
            </h3>

            <div className="relative w-full max-w-2xl aspect-[2.2/1] rounded-xl bg-neutral-950 border border-white/10 overflow-hidden shadow-2xl">
              {/* Draw custom mockup trade screen */}
              <div className="absolute inset-0 bg-[#ffd13b] flex">
                {/* Left offer box */}
                <div className="w-[50%] h-full border-r border-[#69c713] p-4 flex flex-wrap content-start gap-4 relative">
                  <div className="absolute top-2 left-2 bg-red-600 text-white text-[9px] px-2 py-0.5 rounded font-black uppercase">Your Offer</div>
                  
                  {/* Mock items boxes matching screenshot layout */}
                  <div className="absolute top-[23%] left-[7%] w-[16%] h-[22%] border-2 border-dashed border-neutral-800/40 rounded flex items-center justify-center bg-[#dbb530]/40"><span className="text-[8px] font-black text-neutral-800">Red Toilet</span></div>
                  <div className="absolute top-[23%] left-[25%] w-[16%] h-[22%] border-2 border-dashed border-neutral-800/40 rounded flex items-center justify-center bg-[#dbb530]/40"><span className="text-[8px] font-black text-neutral-800">Blue Toilet</span></div>
                  <div className="absolute top-[23%] left-[43%] w-[12%] h-[22%] bg-neutral-900/40 border border-white/10 rounded flex items-center justify-center overflow-hidden">
                    <img src={getBssItem('honey-dipper-0')?.image} className="h-[80%] object-contain" />
                  </div>
                  <div className="absolute top-[23%] left-[58%] w-[15%] h-[22%] bg-neutral-900/40 border border-white/10 rounded flex items-center justify-center overflow-hidden">
                    <img src={getBssItem('scorpio-star-sign-0')?.image} className="h-[85%] object-contain" />
                  </div>
                  <div className="absolute top-[48%] left-[7%] w-[15%] h-[22%] bg-neutral-900/40 border border-white/10 rounded flex items-center justify-center overflow-hidden">
                    <img src={getBssItem('gemini-star-sign-0')?.image} className="h-[85%] object-contain" />
                  </div>
                  <div className="absolute top-[48%] left-[25%] w-[15%] h-[22%] bg-neutral-900/40 border border-white/10 rounded flex items-center justify-center overflow-hidden">
                    <img src={getBssItem('capricorn-star-sign-0')?.image} className="h-[85%] object-contain" />
                  </div>
                </div>

                {/* Right offer box */}
                <div className="w-[50%] h-full p-4 flex justify-center items-center relative">
                  <div className="absolute top-2 right-2 bg-emerald-600 text-white text-[9px] px-2 py-0.5 rounded font-black uppercase">Their Offer</div>
                  <div className="absolute top-[23%] left-[77%] w-[15%] h-[22%] bg-neutral-900/40 border border-white/10 rounded flex items-center justify-center overflow-hidden">
                    <img src={getBssItem('gingerbread-cub-0')?.image} className="h-[90%] object-contain" />
                  </div>
                </div>

                {/* Acceptance checkmarks */}
                <div className="absolute bottom-[20%] left-[10%] w-[35%] h-[35%] border-[10px] border-[#69c713] rounded-full pointer-events-none opacity-40"></div>
                <div className="absolute bottom-[20%] right-[10%] w-[35%] h-[35%] border-[10px] border-[#69c713] rounded-full pointer-events-none opacity-40"></div>
              </div>

              {/* Glowing Bounding Boxes with Labels overlay */}
              {testBoundingBoxes.map((box, idx) => (
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
                {detectedSideA.map(item => (
                  <div key={item.id} className="flex justify-between items-center text-xs p-2 rounded bg-neutral-950/40 border border-white/5">
                    <span className="font-semibold text-neutral-300">{item.name}</span>
                    <span className="font-mono font-bold text-amber-400 bg-amber-400/5 px-2 py-0.5 rounded border border-amber-400/10">
                      {item.value} ★
                    </span>
                  </div>
                ))}
                {/* Toilet skins not in DB listed as TBD/0 */}
                <div className="flex justify-between items-center text-xs p-2 rounded bg-neutral-950/40 border border-white/5 opacity-65">
                  <span className="font-semibold text-neutral-400">Red Toilet (Skin)</span>
                  <span className="font-mono font-bold text-neutral-500">TBD</span>
                </div>
                <div className="flex justify-between items-center text-xs p-2 rounded bg-neutral-950/40 border border-white/5 opacity-65">
                  <span className="font-semibold text-neutral-400">Blue Toilet (Skin)</span>
                  <span className="font-mono font-bold text-neutral-500">TBD</span>
                </div>
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
                {detectedSideB.map(item => (
                  <div key={item.id} className="flex justify-between items-center text-xs p-2 rounded bg-neutral-950/40 border border-white/5">
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
