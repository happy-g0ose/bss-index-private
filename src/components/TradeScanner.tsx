import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Upload, Camera, ArrowRight, Check, Key, Settings, AlertCircle } from 'lucide-react';
import type { BSSItem } from '../data/items';
import { bssItemsData } from '../data/items';
import type { Language } from '../locales';

interface TradeScannerProps {
  onImportToCalculator: (sideA: BSSItem[], sideB: BSSItem[]) => void;
  lang: Language;
}

type TradeType = 'trade-1' | 'trade-2' | 'custom';

export default function TradeScanner({ onImportToCalculator, lang }: TradeScannerProps) {
  const [image, setImage] = useState<string | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<TradeType>('trade-1');
  const [scanStep, setScanStep] = useState(0); // 0: upload/select, 1: scanning, 2: results
  const [detectedSideA, setDetectedSideA] = useState<BSSItem[]>([]);
  const [detectedSideB, setDetectedSideB] = useState<BSSItem[]>([]);
  
  // API Key state
  const [apiKey, setApiKey] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load saved API key from localStorage
    const savedKey = localStorage.getItem('gemini_api_key') || '';
    setApiKey(savedKey);
  }, []);

  // Unified grid coordinates for items in preloaded test trades
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
    'custom': [],
  };

  const getBssItem = (id: string): BSSItem | null => {
    return bssItemsData.find(item => item.id === id) || null;
  };

  // Fuzzy match item names from Gemini output with our database
  const matchItemByName = (detectedName: string): BSSItem | null => {
    const norm = detectedName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!norm) return null;

    // Try exact or close match first
    let bestMatch = bssItemsData.find(item => {
      const itemNorm = item.englishName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const nameNorm = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return itemNorm === norm || nameNorm === norm;
    });

    if (bestMatch) return bestMatch;

    // Try partial inclusion match
    return bssItemsData.find(item => {
      const itemNorm = item.englishName.toLowerCase().replace(/[^a-z0-9]/g, '');
      return itemNorm.includes(norm) || norm.includes(itemNorm);
    }) || null;
  };

  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('gemini_api_key', key);
    setShowSettings(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = reader.result as string;
        setImage(base64Data);
        setSelectedTrade('custom');
        
        // If API Key is configured, run real AI scanning
        if (apiKey) {
          runRealAIScan(base64Data);
        } else {
          // Fallback to demo scan if no API key
          setScanStep(1);
          setTimeout(() => {
            // Mock detect some random items to keep demo running
            const star = getBssItem('shining-star-0');
            const dipper = getBssItem('porcelain-dipper-0');
            setDetectedSideA(star ? [star] : []);
            setDetectedSideB(dipper ? [dipper] : []);
            setScanStep(2);
            setErrorMessage(lang === 'ru' 
              ? 'Настроен демонстрационный режим. Для распознавания реальных скриншотов введите бесплатный ключ API Gemini в настройках.' 
              : 'Demo mode active. Enter a free Gemini API key in settings to scan real screenshots.');
          }, 3000);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const runRealAIScan = async (base64Image: string) => {
    setScanStep(1);
    setErrorMessage(null);

    try {
      // Clean base64 header
      const base64Clean = base64Image.split(',')[1];

      // Prepare request payload for Gemini 1.5 Flash Vision API
      const prompt = `You are a Roblox Bee Swarm Simulator trading assistant. Look at this screenshot of a Roblox BSS trade window. 
Identify all stickers, vouchers, star signs, or beequips inside the offer slots:
- Left side of the trade (Your Offer / Side A)
- Right side of the trade (Their Offer / Side B)

Output a JSON object strictly matching this format:
{
  "sideA": ["Exact English Item Name 1", "Exact English Item Name 2"],
  "sideB": ["Exact English Item Name 3"]
}

Use the exact English names of BSS items. Examples:
- "Scorpio Star Sign"
- "Cub Voucher"
- "Prismatic Mushroom"
- "Black Hive Skin"
- "White Hive Skin"
- "Wavy Festive Hive Skin"
- "Gingerbread Cub"
- "Honey Dipper"

Do not add any markdown formatting, only output raw JSON.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: 'image/jpeg',
                    data: base64Clean
                  }
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json'
          }
        })
      });

      if (!response.ok) {
        throw new Error(lang === 'ru' ? 'Ошибка API Gemini. Проверьте правильность ключа.' : 'Gemini API Error. Verify your API key.');
      }

      const resJson = await response.json();
      const rawText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!rawText) {
        throw new Error(lang === 'ru' ? 'Не удалось получить ответ от нейросети.' : 'Could not parse response from AI.');
      }

      // Parse JSON response
      const parsedData = JSON.parse(rawText);
      const rawSideA: string[] = parsedData.sideA || [];
      const rawSideB: string[] = parsedData.sideB || [];

      // Map names to database items
      const sideAItems: BSSItem[] = rawSideA
        .map(name => matchItemByName(name))
        .filter((item): item is BSSItem => item !== null);

      const sideBItems: BSSItem[] = rawSideB
        .map(name => matchItemByName(name))
        .filter((item): item is BSSItem => item !== null);

      setDetectedSideA(sideAItems);
      setDetectedSideB(sideBItems);
      setScanStep(2);
    } catch (err: any) {
      console.error(err);
      setScanStep(0);
      setErrorMessage(err.message || (lang === 'ru' ? 'Неизвестная ошибка при сканировании.' : 'Unknown scanning error.'));
    }
  };

  const loadTestTrade = (type: 'trade-1' | 'trade-2') => {
    setSelectedTrade(type);
    setImage(type === 'trade-1' ? 'test-trade-1' : 'test-trade-2');
    setScanStep(1);
    setErrorMessage(null);
    
    setTimeout(() => {
      if (type === 'trade-1') {
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
          sideA.push({ ...cubVoucher, id: 'cub-voucher-clone' });
        }

        const sideB: BSSItem[] = [];
        if (wavyFestive) sideB.push(wavyFestive);

        setDetectedSideA(sideA);
        setDetectedSideB(sideB);
      }
      setScanStep(2);
    }, 2000);
  };

  const handleImport = () => {
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
      <div className="text-center space-y-2 relative">
        {/* Settings button */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="absolute right-0 top-0 p-2.5 rounded-xl border border-white/5 bg-neutral-900/60 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900 transition-all cursor-pointer flex items-center gap-2 text-xs font-bold"
        >
          <Settings className="h-4 w-4" />
          <span>{lang === 'ru' ? 'Настройки AI' : 'AI Settings'}</span>
        </button>

        <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-500/10 text-amber-400 border border-amber-500/25 uppercase tracking-widest select-none">
          {lang === 'ru' ? 'Тестовая Функция' : 'Beta Test Feature'}
        </span>
        <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white font-sans uppercase">
          {lang === 'ru' ? 'Умный AI-Сканер Трейдов' : 'Smart AI Trade Scanner'}
        </h2>
        <p className="text-sm text-neutral-400 max-w-xl mx-auto font-medium">
          {lang === 'ru' 
            ? 'Загрузите ЛЮБОЙ скриншот обмена. Нейросеть распознает предметы, сверит их с ценами базы данных и покажет точный W/F/L расчет.'
            : 'Upload ANY screenshot of a trade. The AI will recognize items, compare them with database values, and show the exact W/F/L calculations.'}
        </p>
      </div>

      {/* Settings Modal/Box */}
      {showSettings && (
        <div className="border border-amber-500/30 bg-amber-500/5 rounded-2xl p-5 space-y-4">
          <div className="flex items-start gap-3">
            <Key className="h-5 w-5 text-amber-400 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-bold text-neutral-200 text-sm">
                {lang === 'ru' ? 'Настройка API-ключа Gemini AI' : 'Configure Gemini AI API Key'}
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                {lang === 'ru'
                  ? 'Для распознавания произвольных скриншотов мы используем бесплатную модель Gemini. Ключ API можно получить бесплатно в 3 клика.'
                  : 'For real-time scanning of any custom screenshot, we use the free Gemini model. You can generate an API key in 3 clicks.'}
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="password"
              placeholder={lang === 'ru' ? 'Вставьте ваш API ключ (AIzaSy...)' : 'Paste your API key (AIzaSy...)'}
              defaultValue={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-xs text-neutral-200 placeholder-neutral-600 outline-none focus:border-amber-500/40"
            />
            <button
              onClick={() => saveApiKey(apiKey)}
              className="px-5 py-2.5 rounded-xl bg-amber-500 text-neutral-950 font-black text-xs uppercase tracking-wider cursor-pointer active:scale-95 transition-all"
            >
              {lang === 'ru' ? 'Сохранить' : 'Save Key'}
            </button>
          </div>
          <p className="text-[10px] text-neutral-500 font-medium">
            🔑 {lang === 'ru' ? 'Ваш ключ хранится только в вашем браузере (localStorage) и не передается третьим лицам.' : 'Your key is saved only in your local browser storage.'}{' '}
            <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">
              {lang === 'ru' ? 'Получить ключ бесплатно ->' : 'Get free key here ->'}
            </a>
          </p>
        </div>
      )}

      {/* Error alert */}
      {errorMessage && (
        <div className="p-4 bg-red-500/10 border border-red-500/25 rounded-2xl flex items-start gap-3 text-red-400">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <h4 className="text-xs font-black uppercase tracking-wider">{lang === 'ru' ? 'Ошибка сканирования' : 'Scan Error'}</h4>
            <p className="text-xs font-medium leading-relaxed">{errorMessage}</p>
          </div>
        </div>
      )}

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
              {lang === 'ru' ? 'Загрузить любой скриншот трейда' : 'Upload any trade screenshot'}
            </h3>
            <p className="text-xs text-neutral-500 max-w-xs font-medium">
              {lang === 'ru' 
                ? 'Перетащите изображение или выберите файл. Нейросеть сама прочитает сделку!' 
                : 'Drag and drop an image. The AI will parse the trade dynamically!'}
            </p>
          </div>

          {/* Test Screenshot Options */}
          <div className="flex flex-col border border-white/5 bg-neutral-900/40 rounded-2xl p-6 space-y-4 justify-between">
            <div className="space-y-2">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Camera className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-neutral-200 font-sans">
                {lang === 'ru' ? 'Симуляция сканирования' : 'Scan Simulator (Offline)'}
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed font-medium">
                {lang === 'ru'
                  ? 'Вы можете протестировать работу сканера на двух готовых сделках, без подключения нейросети:'
                  : 'You can simulate the scanner offline on two preloaded BSS trades:'}
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
        <div className="border border-white/5 bg-neutral-900/60 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[400px] text-center space-y-6 overflow-hidden">
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
                {apiKey ? 'Gemini AI Scanning...' : 'Simulating Scan...'}
              </span>
            </div>
            <h3 className="font-bold text-neutral-200 text-lg font-sans">
              {apiKey 
                ? (lang === 'ru' ? 'Нейросеть Gemini распознает скриншот...' : 'Gemini AI is parsing the image...')
                : (lang === 'ru' ? 'Симуляция сопоставления границ...' : 'Cross-referencing offline bounds...')}
            </h3>
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
              {image && image !== 'test-trade-1' && image !== 'test-trade-2' ? (
                /* Show their actual uploaded image! */
                <img src={image} className="w-full h-full object-contain" />
              ) : (
                /* Draw custom mockup trade screen background matching BSS */
                <div className="absolute inset-0 bg-[#ffd13b] relative">
                  <div className="absolute top-0 left-[50%] w-[4px] h-full bg-[#69c713]" />
                  <div className="absolute top-2 left-2 bg-red-600 text-white text-[8px] md:text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-wider">Your Offer</div>
                  <div className="absolute top-2 right-2 bg-emerald-600 text-white text-[8px] md:text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-wider">Opponent's Offer</div>
                  
                  {selectedTrade === 'trade-1' ? (
                    <>
                      <div className="absolute top-[23%] left-[5%] w-[9%] h-[22%] border border-neutral-800/40 rounded flex flex-col items-center justify-center bg-[#dbb530]/40 overflow-hidden">
                        <span className="text-[6px] font-black text-neutral-800 leading-none text-center">Red Port-O-Hive</span>
                      </div>
                      <div className="absolute top-[23%] left-[16%] w-[9%] h-[22%] border border-neutral-800/40 rounded flex flex-col items-center justify-center bg-[#dbb530]/40 overflow-hidden">
                        <span className="text-[6px] font-black text-neutral-800 leading-none text-center">Blue Port-O-Hive</span>
                      </div>
                      <div className="absolute top-[23%] left-[27%] w-[9%] h-[22%] bg-neutral-900/40 border border-white/10 rounded flex items-center justify-center overflow-hidden">
                        <img src={getBssItem('honey-dipper-0')?.image} className="h-[80%] object-contain" />
                      </div>
                      <div className="absolute top-[23%] left-[38%] w-[9%] h-[22%] bg-neutral-900/40 border border-white/10 rounded flex items-center justify-center overflow-hidden">
                        <img src={getBssItem('scorpio-star-sign-0')?.image} className="h-[85%] object-contain" />
                      </div>
                      <div className="absolute top-[48%] left-[5%] w-[9%] h-[22%] bg-neutral-900/40 border border-white/10 rounded flex items-center justify-center overflow-hidden">
                        <img src={getBssItem('gemini-star-sign-0')?.image} className="h-[85%] object-contain" />
                      </div>
                      <div className="absolute top-[48%] left-[16%] w-[9%] h-[22%] bg-neutral-900/40 border border-white/10 rounded flex items-center justify-center overflow-hidden">
                        <img src={getBssItem('capricorn-star-sign-0')?.image} className="h-[85%] object-contain" />
                      </div>
                      <div className="absolute top-[23%] left-[60%] w-[9%] h-[22%] bg-neutral-900/40 border border-white/10 rounded flex items-center justify-center overflow-hidden">
                        <img src={getBssItem('gingerbread-cub-0')?.image} className="h-[90%] object-contain" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="absolute top-[23%] left-[5%] w-[9%] h-[22%] bg-neutral-900/40 border border-white/10 rounded flex items-center justify-center overflow-hidden">
                        <img src={getBssItem('prismatic-mushroom-0')?.image} className="h-[80%] object-contain" />
                      </div>
                      <div className="absolute top-[23%] left-[16%] w-[9%] h-[22%] bg-neutral-900/40 border border-white/10 rounded flex items-center justify-center overflow-hidden">
                        <img src={getBssItem('black-hive-skin-0')?.image} className="h-[80%] object-contain" />
                      </div>
                      <div className="absolute top-[23%] left-[27%] w-[9%] h-[22%] bg-neutral-900/40 border border-white/10 rounded flex items-center justify-center overflow-hidden">
                        <img src={getBssItem('white-hive-skin-0')?.image} className="h-[80%] object-contain" />
                      </div>
                      <div className="absolute top-[23%] left-[38%] w-[9%] h-[22%] bg-neutral-900/40 border border-white/10 rounded flex items-center justify-center overflow-hidden">
                        <img src={getBssItem('cub-voucher-0')?.image} className="h-[80%] object-contain" />
                      </div>
                      <div className="absolute top-[48%] left-[5%] w-[9%] h-[22%] bg-neutral-900/40 border border-white/10 rounded flex items-center justify-center overflow-hidden">
                        <img src={getBssItem('cub-voucher-0')?.image} className="h-[80%] object-contain" />
                      </div>
                      <div className="absolute top-[23%] left-[60%] w-[9%] h-[22%] bg-neutral-900/40 border border-white/10 rounded flex items-center justify-center overflow-hidden">
                        <img src={getBssItem('wavy-festive-hive-skin-0')?.image} className="h-[80%] object-contain" />
                      </div>
                    </>
                  )}

                  <div className="absolute bottom-[10%] left-[5%] w-[40%] h-[40%] border-[8px] border-[#69c713]/40 rounded-full pointer-events-none"></div>
                  <div className="absolute bottom-[10%] right-[5%] w-[40%] h-[40%] border-[8px] border-[#69c713]/40 rounded-full pointer-events-none"></div>
                </div>
              )}

              {/* Glowing Bounding Boxes overlay */}
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
                {detectedSideA.length === 0 && (
                  <div className="text-xs text-neutral-500 italic p-2">{lang === 'ru' ? 'Ничего не обнаружено' : 'No items detected'}</div>
                )}
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
                {detectedSideB.length === 0 && (
                  <div className="text-xs text-neutral-500 italic p-2">{lang === 'ru' ? 'Ничего не обнаружено' : 'No items detected'}</div>
                )}
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
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-600 hover:to-teal-500 text-neutral-950 font-black text-xs py-3.5 px-6 rounded-xl shadow-lg shadow-emerald-500/10 cursor-pointer active:scale-98 transition-all duration-200 uppercase tracking-wider animate-pulse"
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
