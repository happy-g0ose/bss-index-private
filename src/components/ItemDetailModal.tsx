import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, SlidersHorizontal, Share2 } from 'lucide-react';
import { itemUrl, slugify } from '../itemSlug';
import type { BSSItem } from '../data/items';
import { formatRollValue } from '../data/rollValue';
import type { Language } from '../locales';
import { t, translateDemand, translateStability, translateCategory } from '../locales';

interface ItemDetailModalProps {
  item: BSSItem | null;
  onClose: () => void;
  onAddToSideA: (item: BSSItem) => void;
  onAddToSideB: (item: BSSItem) => void;
  lang: Language;
}

export default function ItemDetailModal({ item, onClose, onAddToSideA, onAddToSideB, lang }: ItemDetailModalProps) {
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  // Lock background scroll when open
  useEffect(() => {
    if (item) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [item]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!item) return null;

  // Chart geometry. Two series share the same X axis (the source snapshots):
  //   - price on the left axis (the item's own colour)
  //   - demand on the right axis 0..5 (source data, never invented)
  // Both come straight from `values_live.json` -> bot/items.json, so nothing
  // on this chart is generated on the client.
  const drawChart = () => {
    const prices = item.historicalPrices;
    const demand = item.historicalDemand || [];
    const width = 500;
    const height = 190;
    const padL = 46; // room for the price axis labels
    const padR = 38; // room for the demand axis labels
    const padT = 14;
    const padB = 24; // room for the axis title / baseline
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;

    const minVal = Math.min(...prices);
    const maxVal = Math.max(...prices);
    const range = maxVal - minVal || 10;
    // Pad the price axis a little so the line never sits on the frame.
    const axisMin = Math.max(0, minVal - range * 0.08);
    const axisMax = maxVal + range * 0.08;
    const axisRange = axisMax - axisMin || 10;

    const xAt = (idx: number) => padL + (idx * plotW) / Math.max(1, prices.length - 1);
    const priceY = (v: number) =>
      padT + plotH - ((v - axisMin) / axisRange) * plotH;
    const demandY = (d: number) =>
      padT + plotH - (Math.max(0, Math.min(5, d)) / 5) * plotH;

    const pricePoints = prices.map((price, idx) => ({
      x: xAt(idx),
      y: priceY(price),
    }));

    // Demand is a sequence of separate segments: where the source has null we
    // break the line instead of drawing a fake value through the gap.
    const demandSegments: { x: number; y: number }[][] = [];
    let segment: { x: number; y: number }[] = [];
    demand.forEach((d, idx) => {
      if (d === null || d === undefined || !Number.isFinite(d)) {
        if (segment.length) demandSegments.push(segment);
        segment = [];
      } else {
        segment.push({ x: xAt(idx), y: demandY(d) });
      }
    });
    if (segment.length) demandSegments.push(segment);

    const pathD = `M ${pricePoints.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ')}`;
    const areaD = `${pathD} L ${pricePoints[pricePoints.length - 1].x.toFixed(1)} ${(padT + plotH).toFixed(1)} L ${pricePoints[0].x.toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;
    const demandPaths = demandSegments
      .filter((s) => s.length > 1)
      .map((s) => `M ${s.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ')}`);

    const priceTicks = [axisMax, axisMin + axisRange / 2, axisMin];
    const priceTickLabels = priceTicks.map((v) =>
      v >= 1000 ? `${(v / 1000).toFixed(1)}k` : Number(v.toFixed(v < 10 ? 1 : 0)).toString()
    );

    return {
      pathD,
      areaD,
      pricePoints,
      demandPaths,
      priceTicks,
      priceTickLabels,
      demandTicks: [5, 3, 1, 0],
      priceY,
      demandY,
      padL, padR, padT, padB, plotW, plotH,
      width, height,
    };
  };

  const chart = drawChart();

  // Mouse event handlers for interactive chart
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const svgX = (clientX / rect.width) * chart.width;

    let closestIdx = 0;
    let minDistance = Infinity;
    chart.pricePoints.forEach((p, idx) => {
      const dist = Math.abs(p.x - svgX);
      if (dist < minDistance) {
        minDistance = dist;
        closestIdx = idx;
      }
    });

    setHoveredPointIndex(closestIdx);
  };

  const handleMouseLeave = () => {
    setHoveredPointIndex(null);
  };

  const getWeeksAgoText = (index: number, lang: Language) => {
    if (item.historicalDates && item.historicalDates[index]) {
      const d = item.historicalDates[index];
      const parts = d.split('-');
      return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : d;
    }
    if (lang === 'ru') {
      switch (index) {
        case 0: return '6 недель назад';
        case 1: return '5 недель назад';
        case 2: return '4 недели назад';
        case 3: return '3 недели назад';
        case 4: return '2 недели назад';
        case 5: return 'Текущая неделя';
        default: return '';
      }
    } else {
      switch (index) {
        case 0: return '6 weeks ago';
        case 1: return '5 weeks ago';
        case 2: return '4 weeks ago';
        case 3: return '3 weeks ago';
        case 4: return '2 weeks ago';
        case 5: return 'Current week';
        default: return '';
      }
    }
  };



  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 md:p-8">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 30 }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          style={{ '--hover-glow': item.glowColor } as any}
          className="relative w-full max-w-3xl rounded-2xl bg-[#0b0f19] border border-white/5 shadow-2xl overflow-hidden z-10 max-h-[90vh] flex flex-col"
        >
          {/* Neon Corner Glow */}
          <div className="absolute top-0 right-0 w-80 h-80 rounded-full pointer-events-none blur-3xl opacity-10" style={{ background: `radial-gradient(circle, ${item.glowColor} 0%, transparent 70%)` }} />

          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/5 bg-neutral-950/40 backdrop-blur-md z-20">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded border ${item.badgeColor}`}>
                {translateCategory(item.category, lang)}
              </span>
            </div>
            
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-neutral-900 border border-white/5 text-neutral-400 hover:text-neutral-200 cursor-pointer transition-colors"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 z-10">
            {/* Title & Base info with Image */}
            <div className="flex items-center gap-5">
              <div className="h-20 w-20 rounded-2xl bg-neutral-950/60 border border-white/5 flex items-center justify-center shadow-inner overflow-hidden select-none shrink-0">
                <img
                  src={item.image}
                  alt={item.name}
                  className="h-16 w-16 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-neutral-50 tracking-tight leading-none">
                  {lang === 'ru' ? item.name : item.englishName}
                </h2>
                <span className="text-xs md:text-sm text-neutral-500 font-mono block mt-1.5">
                  {lang === 'ru' ? item.englishName : item.name}
                </span>
              </div>
            </div>

            {/* Core Stats Badge Grid */}
            {item.category !== 'Биквипы' && (
              <div className="grid grid-cols-3 gap-4 border-y border-white/5 py-4">
                <div className="text-center md:text-left overflow-hidden">
                  <div className="text-[10px] text-neutral-500 uppercase tracking-widest font-semibold">{t('item.baseValue', lang)}</div>
                  <div className="flex flex-col items-center md:items-start leading-none mt-1">
                    <span className="text-xl md:text-2xl font-black text-amber-400 font-mono flex items-center gap-0.5">
                      {Number(item.value.toFixed(2))} <span className="text-xs font-normal text-amber-500">★</span>
                    </span>
                    {item.valueLow !== item.valueHigh && (
                      <span className="text-xs text-neutral-500 font-bold font-mono">
                        {Number(item.valueLow.toFixed(2))} - {Number(item.valueHigh.toFixed(2))}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-center md:text-left">
                  <div className="text-[10px] text-neutral-500 uppercase tracking-widest font-semibold">{t('item.demandLevel', lang)}</div>
                  <span className={`text-[10px] md:text-xs font-bold px-3 py-1 rounded border inline-block mt-1 ${
                    item.demand === 'Хайп' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                    item.demand === 'Высокий' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                    item.demand === 'Средний' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                    'bg-neutral-800 text-neutral-400 border-neutral-700'
                  }`}>
                    {translateDemand(item.demand, lang)}
                  </span>
                </div>
                <div className="text-center md:text-left">
                  <div className="text-[10px] text-neutral-500 uppercase tracking-widest font-semibold">{t('item.stability', lang)}</div>
                  <span className={`text-[10px] md:text-xs font-bold px-3 py-1 rounded border inline-block mt-1 ${
                    item.stability === 'Растет' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    item.stability === 'Падает' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                    'bg-neutral-800 text-neutral-400 border-neutral-700'
                  }`}>
                    {translateStability(item.stability, lang)}
                  </span>
                </div>
              </div>
            )}

            {/* Price Chart Graphic or Beequip Stats and Rolls */}
            {item.beequipData ? (
              <div className="space-y-3">
                <h4 className="text-xs uppercase font-bold tracking-widest text-neutral-400 flex items-center gap-1.5 select-none">
                  <SlidersHorizontal className="h-4 w-4 text-amber-400" />
                  {lang === 'ru' ? 'Характеристики и Роллы' : 'Stats & Rolls'}
                </h4>
                
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                  {item.beequipData.map((group, gIdx) => (
                    <div key={gIdx} className="rounded-xl border border-white/5 bg-neutral-950/60 p-4 space-y-2.5">
                      <h5 className="text-[10px] uppercase font-mono font-black text-neutral-400 tracking-wider select-none border-b border-white/5 pb-1">
                        {group.groupName}
                      </h5>
                      <div className="grid grid-cols-1 gap-2">
                        {group.rolls.map((roll, rIdx) => {
                          // Determine demand color
                          let demandStyle = 'bg-neutral-800 text-neutral-400 border-neutral-700/20';
                          if (roll.demand === 'Хайп') {
                            demandStyle = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                          } else if (roll.demand === 'Высокий') {
                            demandStyle = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                          } else if (roll.demand === 'Средний') {
                            demandStyle = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                          } else {
                            demandStyle = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                          }
                          
                          const valueText = formatRollValue(roll);

                          return (
                            <div key={rIdx} className="flex items-center justify-between gap-3 text-xs p-2 rounded-lg bg-neutral-900/40 hover:bg-neutral-900/80 transition-colors border border-white/5">
                              <span className="font-medium text-neutral-200 flex-1 break-words pr-2 leading-snug">
                                {roll.rollName}
                              </span>
                              <div className="flex items-center gap-2 shrink-0">
                                {/* Value */}
                                <span className="font-mono font-bold text-amber-400 bg-amber-400/5 px-2 py-0.5 rounded border border-amber-400/10">
                                  {valueText}
                                </span>
                                {/* Demand */}
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${demandStyle}`}>
                                  {roll.demand}
                                </span>
                                {/* Quick add to Calculator */}
                                <div className="flex items-center gap-1 ml-1">
                                  <button
                                    onClick={() => {
                                      // Create a custom roll-specific item
                                      const rollItem: BSSItem = {
                                        ...item,
                                        id: `${item.id}-roll-${roll.rollName.replace(/\s+/g, '-')}`,
                                        name: `${item.name} (${roll.rollName})`,
                                        englishName: `${item.englishName} (${roll.rollName})`,
                                        value: roll.value,
                                        valueLow: roll.valueLow,
                                        valueHigh: roll.valueHigh,
                                        demand: roll.demand,
                                      };
                                      onAddToSideA(rollItem);
                                    }}
                                    className="p-1.5 rounded bg-violet-600 hover:bg-violet-500 text-white font-mono text-[9px] font-black cursor-pointer shadow-sm hover:scale-105 transition-transform"
                                    title={lang === 'ru' ? 'Добавить в Левую сторону' : 'Add to Side A'}
                                  >
                                    +A
                                  </button>
                                  <button
                                    onClick={() => {
                                      const rollItem: BSSItem = {
                                        ...item,
                                        id: `${item.id}-roll-${roll.rollName.replace(/\s+/g, '-')}`,
                                        name: `${item.name} (${roll.rollName})`,
                                        englishName: `${item.englishName} (${roll.rollName})`,
                                        value: roll.value,
                                        valueLow: roll.valueLow,
                                        valueHigh: roll.valueHigh,
                                        demand: roll.demand,
                                      };
                                      onAddToSideB(rollItem);
                                    }}
                                    className="p-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-mono text-[9px] font-black cursor-pointer shadow-sm hover:scale-105 transition-transform"
                                    title={lang === 'ru' ? 'Добавить в Правою сторону' : 'Add to Side B'}
                                  >
                                    +B
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <h4 className="text-xs uppercase font-bold tracking-widest text-neutral-400 flex items-center gap-1.5 select-none">
                  <Clock className="h-4 w-4 text-blue-400" />
                  {t('item.chart', lang)}
                </h4>
                
                <div className="relative rounded-xl bg-neutral-950/60 border border-white/5 p-4 overflow-hidden">
                  {/* Legend — two series, both read straight from source data */}
                  <div className="flex items-center justify-between gap-3 mb-2 text-[9px] font-mono font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1.5" style={{ color: item.hexColor || '#a855f7' }}>
                      <span className="inline-block w-3 h-0.5 rounded" style={{ background: item.hexColor || '#a855f7' }} />
                      {lang === 'ru' ? 'Цена ★' : 'Price ★'}
                    </span>
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <span className="inline-block w-3 border-t-2 border-dashed border-emerald-400" />
                      {lang === 'ru' ? 'Спрос' : 'Demand'}
                    </span>
                  </div>

                  <svg
                    className="w-full overflow-visible cursor-crosshair"
                    viewBox={`0 0 ${chart.width} ${chart.height}`}
                    preserveAspectRatio="none"
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                  >
                    <defs>
                      <linearGradient id="chart-area" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={item.hexColor || '#a855f7'} stopOpacity="0.30" />
                        <stop offset="60%" stopColor={item.hexColor || '#a855f7'} stopOpacity="0.06" />
                        <stop offset="100%" stopColor={item.hexColor || '#a855f7'} stopOpacity="0" />
                      </linearGradient>
                      <filter id="chart-glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                    </defs>

                    {/* Horizontal grid + left price axis labels */}
                    {chart.priceTicks.map((y, i) => (
                      <g key={`h-${i}`}>
                        <line
                          x1={chart.padL}
                          y1={y}
                          x2={chart.width - chart.padR}
                          y2={y}
                          stroke="rgba(255,255,255,0.06)"
                          strokeWidth="1"
                        />
                        <text
                          x={chart.padL - 6}
                          y={y + 3}
                          textAnchor="end"
                          fill="#71717a"
                          fontSize="9"
                          fontFamily="ui-monospace, monospace"
                        >
                          {chart.priceTickLabels[i]}
                        </text>
                      </g>
                    ))}

                    {/* Right demand axis labels (0..5, from source scale) */}
                    {chart.demandTicks.map((d) => {
                      const y = chart.demandY(d);
                      return (
                        <text
                          key={`d-${d}`}
                          x={chart.width - chart.padR + 6}
                          y={y + 3}
                          textAnchor="start"
                          fill="#34d399"
                          fontSize="9"
                          fontFamily="ui-monospace, monospace"
                        >
                          {d}
                        </text>
                      );
                    })}

                    {/* Vertical guide on hover */}
                    {hoveredPointIndex !== null && (
                      <line
                        x1={chart.pricePoints[hoveredPointIndex].x}
                        y1={chart.padT}
                        x2={chart.pricePoints[hoveredPointIndex].x}
                        y2={chart.padT + chart.plotH}
                        stroke="rgba(255, 255, 255, 0.14)"
                        strokeDasharray="4 4"
                        strokeWidth="1.5"
                      />
                    )}

                    {/* Price: shaded area + solid line */}
                    <motion.path
                      d={chart.areaD}
                      fill="url(#chart-area)"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.8, delay: 0.3 }}
                    />
                    <motion.path
                      d={chart.pathD}
                      fill="none"
                      stroke={item.hexColor || '#a855f7'}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      filter="url(#chart-glow)"
                      initial={{ strokeDasharray: `${chart.pathD.length} ${chart.pathD.length}`, strokeDashoffset: chart.pathD.length }}
                      animate={{ strokeDashoffset: 0 }}
                      transition={{ duration: 1.2, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                    />

                    {/* Demand: dashed line, split where the source has no data */}
                    {chart.demandPaths.map((d, i) => (
                      <motion.path
                        key={`demand-${i}`}
                        d={d}
                        fill="none"
                        stroke="#34d399"
                        strokeWidth="1.8"
                        strokeDasharray="5 4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.9 }}
                        transition={{ duration: 0.7, delay: 0.5 }}
                      />
                    ))}

                    {/* Price dots */}
                    {chart.pricePoints.map((p, idx) => (
                      <circle
                        key={idx}
                        cx={p.x}
                        cy={p.y}
                        r={hoveredPointIndex === idx ? 5 : 2.5}
                        className="transition-all duration-200"
                        fill={item.hexColor || '#a855f7'}
                        stroke="#0b0f19"
                        strokeWidth="1.5"
                      />
                    ))}

                    {/* Demand dot on the hovered snapshot (only when source has it) */}
                    {hoveredPointIndex !== null &&
                      item.historicalDemand?.[hoveredPointIndex] != null && (
                        <circle
                          cx={chart.pricePoints[hoveredPointIndex].x}
                          cy={chart.demandY(item.historicalDemand[hoveredPointIndex] as number)}
                          r="4"
                          fill="#34d399"
                          stroke="#0b0f19"
                          strokeWidth="1.5"
                        />
                      )}
                  </svg>

                  {/* Tooltip Overlay — exact values from the snapshot, no estimates */}
                  {(() => {
                    if (hoveredPointIndex === null) return null;
                    const activePoint = chart.pricePoints[hoveredPointIndex];
                    const rawVal = item.historicalPrices[hoveredPointIndex];
                    const rawDemand = item.historicalDemand?.[hoveredPointIndex];

                    const priceValue = rawVal >= 1000 ? `${(rawVal / 1000).toFixed(1)}k` : rawVal.toFixed(2);
                    const tooltipLeft = `${(activePoint.x / chart.width) * 100}%`;
                    const tooltipTop = `${(activePoint.y / chart.height) * 100}%`;

                    const lastIndex = item.historicalPrices.length - 1;
                    let transformStr = 'translateX(-50%)';
                    if (hoveredPointIndex === 0) {
                      transformStr = 'translateX(10px)';
                    } else if (hoveredPointIndex === lastIndex) {
                      transformStr = 'translateX(-105%)';
                    }

                    const demandLabel =
                      rawDemand === null || rawDemand === undefined
                        ? (lang === 'ru' ? 'нет данных' : 'no data')
                        : `${rawDemand}/5`;

                    return (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ duration: 0.15 }}
                        className="absolute z-30 pointer-events-none p-2 bg-neutral-900/90 backdrop-blur border border-white/10 rounded-lg shadow-xl text-[10px] font-mono leading-tight flex flex-col gap-0.5 whitespace-nowrap"
                        style={{
                          left: tooltipLeft,
                          top: `calc(${tooltipTop} - 62px)`,
                          transform: transformStr,
                        }}
                      >
                        <span className="text-neutral-400 font-bold">{getWeeksAgoText(hoveredPointIndex, lang)}</span>
                        <span className="font-black text-[11px] flex items-center gap-0.5 justify-center" style={{ color: item.hexColor || '#a855f7' }}>
                          {priceValue} <span className="text-[9px] font-normal" style={{ color: item.hexColor || '#a855f7' }}>★</span>
                        </span>
                        <span className="text-emerald-400 font-bold flex items-center gap-0.5 justify-center">
                          {lang === 'ru' ? 'Спрос' : 'Demand'}: {demandLabel}
                        </span>
                      </motion.div>
                    );
                  })()}

                  {/* X-Axis labels */}
                  <div className="flex justify-between items-center text-[9px] text-neutral-500 font-mono font-bold mt-1 pt-2 border-t border-white/5">
                    {(() => {
                      const dates = item.historicalDates || [];
                      if (dates.length === 0) {
                        return (
                          <>
                            <span>{lang === 'ru' ? '6 нед. назад' : '6 weeks ago'}</span>
                            <span>{lang === 'ru' ? '4 нед. назад' : '4 weeks ago'}</span>
                            <span>{lang === 'ru' ? '2 нед. назад' : '2 weeks ago'}</span>
                            <span>{lang === 'ru' ? 'Текущая неделя' : 'Current week'}</span>
                          </>
                        );
                      }
                      const formatDateStr = (d: string) => {
                        const parts = d.split('-');
                        return parts.length === 3 ? `${parts[2]}.${parts[1]}` : d;
                      };
                      const len = dates.length;
                      if (len < 4) {
                        return dates.map((d, k) => (
                          <span key={k}>{formatDateStr(d)}</span>
                        ));
                      }
                      const idxs = [
                        0,
                        Math.floor((len - 1) * 0.33),
                        Math.floor((len - 1) * 0.66),
                        len - 1
                      ];
                      return idxs.map((i, k) => (
                        <span key={k}>{formatDateStr(dates[i])}</span>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Standalone SEO page link, embeddable widget + share */}
          <div className="px-6 pb-2 flex flex-wrap items-center justify-between gap-3 text-[11px] z-10">
            <div className="flex items-center gap-3">
              <a
                href={itemUrl(item, lang)}
                className="text-neutral-500 hover:text-amber-400 transition-colors no-underline"
              >
                {lang === 'ru' ? 'Страница предмета' : 'Item page'}
              </a>
              <a
                href={`/w/${slugify(item.englishName || item.id || item.name)}/`}
                target="_blank"
                rel="noopener"
                className="text-neutral-500 hover:text-amber-400 transition-colors no-underline"
              >
                {lang === 'ru' ? 'Виджет' : 'Widget'}
              </a>
              <a
                href={`/api/v1/items/${slugify(item.englishName || item.id || item.name)}.json`}
                target="_blank"
                rel="noopener"
                className="text-neutral-500 hover:text-amber-400 transition-colors no-underline"
              >
                JSON
              </a>
            </div>
            <button
              onClick={async () => {
                const url = `${window.location.origin}${itemUrl(item, lang)}`;
                try {
                  if (navigator.share) {
                    await navigator.share({ title: item.name, url });
                  } else {
                    await navigator.clipboard.writeText(url);
                  }
                } catch {
                  /* user cancelled or clipboard blocked */
                }
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-900/60 border border-white/5 text-neutral-400 hover:text-neutral-200 hover:border-white/15 transition-all cursor-pointer"
            >
              <Share2 className="h-3.5 w-3.5" />
              {lang === 'ru' ? 'Поделиться' : 'Share'}
            </button>
          </div>

          {/* Footer controls: Add directly to Trade side A/B */}
          {item.category !== 'Биквипы' && (
            <div className="p-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 bg-neutral-950/40 z-10 text-xs">
              <span className="text-neutral-500">BSS Value Guide • {lang === 'ru' ? 'Все цены обновляются еженедельно' : 'All prices are updated weekly'}</span>
              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  onClick={() => {
                    onAddToSideA(item);
                    onClose();
                  }}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold transition-all duration-200 cursor-pointer"
                >
                  + {lang === 'ru' ? 'Отдать (А)' : 'Give (A)'}
                </button>
                <button
                  onClick={() => {
                    onAddToSideB(item);
                    onClose();
                  }}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all duration-200 cursor-pointer"
                >
                  + {lang === 'ru' ? 'Получить (Б)' : 'Receive (B)'}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
