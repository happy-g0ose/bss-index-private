/**
 * Per-category colours, shared by every generator.
 *
 * Why this exists: the item data in bot/items.json carries per-item colours
 * that were hand-assigned and ended up inconsistent — the same category could
 * show up in red, amber and pink. A category is a category, so it gets one
 * colour everywhere: catalog cards, item pages, widgets and the API.
 *
 * Generated from the original getCategoryStyles() in src/data/items.ts.
 * Plain CommonJS so the build scripts can require it — the browser never runs
 * this, the values are baked into the generated files.
 */
function getCategoryStyles(category) {
  switch (category) {
    case 'Скины на каба':
    case 'Скины на каба':
      return {
        glowColor: 'rgba(245, 158, 11, 0.35)',
        borderColor: 'border-amber-500/40 group-hover:border-amber-500/70',
        badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        textColor: 'text-amber-400',
        hexColor: '#f59e0b',
      };
    case 'Скины на улей':
      return {
        glowColor: 'rgba(168, 85, 247, 0.35)',
        borderColor: 'border-purple-500/40 group-hover:border-purple-500/70',
        badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
        textColor: 'text-purple-400',
        hexColor: '#a855f7',
      };
    case 'Ваучеры':
      return {
        glowColor: 'rgba(16, 185, 129, 0.35)',
        borderColor: 'border-emerald-500/40 group-hover:border-emerald-500/70',
        badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        textColor: 'text-emerald-400',
        hexColor: '#10b981',
      };
    case 'Стикеры пчел':
      return {
        glowColor: 'rgba(234, 179, 8, 0.35)',
        borderColor: 'border-yellow-500/40 group-hover:border-yellow-500/70',
        badgeColor: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
        textColor: 'text-yellow-400',
        hexColor: '#eab308',
      };
    case 'Стикеры медведей':
      return {
        glowColor: 'rgba(249, 115, 22, 0.35)',
        borderColor: 'border-orange-500/40 group-hover:border-orange-500/70',
        badgeColor: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
        textColor: 'text-orange-400',
        hexColor: '#f97316',
      };
    case 'Стикеры мобов':
      return {
        glowColor: 'rgba(239, 68, 68, 0.35)',
        borderColor: 'border-red-500/40 group-hover:border-red-500/70',
        badgeColor: 'bg-red-500/10 text-red-400 border-red-500/30',
        textColor: 'text-red-400',
        hexColor: '#ef4444',
      };
    case 'Искусство':
      return {
        glowColor: 'rgba(236, 72, 153, 0.35)',
        borderColor: 'border-pink-500/40 group-hover:border-pink-500/70',
        badgeColor: 'bg-pink-500/10 text-pink-400 border-pink-500/30',
        textColor: 'text-pink-400',
        hexColor: '#ec4899',
      };
    case 'Драгоценности':
      return {
        glowColor: 'rgba(6, 182, 212, 0.35)',
        borderColor: 'border-cyan-500/40 group-hover:border-cyan-500/70',
        badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
        textColor: 'text-cyan-400',
        hexColor: '#06b6d4',
      };
    case 'Иконки нектара':
      return {
        glowColor: 'rgba(244, 63, 94, 0.35)',
        borderColor: 'border-rose-500/40 group-hover:border-rose-500/70',
        badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
        textColor: 'text-rose-400',
        hexColor: '#f43f5e',
      };
    case 'Цветы':
      return {
        glowColor: 'rgba(217, 70, 239, 0.35)',
        borderColor: 'border-fuchsia-500/40 group-hover:border-fuchsia-500/70',
        badgeColor: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/30',
        textColor: 'text-fuchsia-400',
        hexColor: '#d946ef',
      };
    case 'Грибы':
      return {
        glowColor: 'rgba(251, 113, 133, 0.35)',
        borderColor: 'border-rose-400/40 group-hover:border-rose-400/70',
        badgeColor: 'bg-rose-400/10 text-rose-400 border-rose-400/30',
        textColor: 'text-rose-400',
        hexColor: '#fb7185',
      };
    case 'Листья':
      return {
        glowColor: 'rgba(132, 204, 22, 0.35)',
        borderColor: 'border-lime-500/40 group-hover:border-lime-500/70',
        badgeColor: 'bg-lime-500/10 text-lime-400 border-lime-500/30',
        textColor: 'text-lime-400',
        hexColor: '#84cc16',
      };
    case 'Инструменты':
      return {
        glowColor: 'rgba(14, 165, 233, 0.35)',
        borderColor: 'border-sky-500/40 group-hover:border-sky-500/70',
        badgeColor: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
        textColor: 'text-sky-400',
        hexColor: '#0ea5e9',
      };
    case 'Марки':
      return {
        glowColor: 'rgba(99, 102, 241, 0.35)',
        borderColor: 'border-indigo-500/40 group-hover:border-indigo-500/70',
        badgeColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
        textColor: 'text-indigo-400',
        hexColor: '#6366f1',
      };
    case 'Стикеры Пчелождества':
      return {
        glowColor: 'rgba(20, 184, 166, 0.35)',
        borderColor: 'border-teal-500/40 group-hover:border-teal-500/70',
        badgeColor: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
        textColor: 'text-teal-400',
        hexColor: '#14b8a6',
      };
    case 'Звездные знаки':
      return {
        glowColor: 'rgba(192, 132, 252, 0.4)',
        borderColor: 'border-purple-400/50 group-hover:border-purple-400/80',
        badgeColor: 'bg-purple-500/15 text-purple-300 border-purple-400/40',
        textColor: 'text-purple-300',
        hexColor: '#c084fc',
      };
    case 'Биквипы':
      return {
        glowColor: 'rgba(59, 130, 246, 0.35)',
        borderColor: 'border-blue-500/40 group-hover:border-blue-500/70',
        badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
        textColor: 'text-blue-400',
        hexColor: '#3b82f6',
      };
    case 'Разное':
    default:
      return {
        glowColor: 'rgba(148, 163, 184, 0.35)',
        borderColor: 'border-slate-400/40 group-hover:border-slate-400/70',
        badgeColor: 'bg-slate-500/10 text-slate-300 border-slate-400/30',
        textColor: 'text-slate-300',
        hexColor: '#94a3b8',
      };
  }
}
const FALLBACK = {
  glowColor: 'rgba(148, 163, 184, 0.35)',
  borderColor: 'border-slate-500/40 group-hover:border-slate-500/70',
  badgeColor: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  textColor: 'text-slate-400',
  hexColor: '#94a3b8',
};

/** Return a copy of `item` with the category colours applied. */
function applyCategoryStyles(item) {
  const styles = getCategoryStyles(item.category);
  return {
    ...item,
    glowColor: styles.glowColor,
    borderColor: styles.borderColor,
    badgeColor: styles.badgeColor,
    textColor: styles.textColor,
    hexColor: styles.hexColor,
  };
}

module.exports = { getCategoryStyles, applyCategoryStyles };
