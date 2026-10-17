export type Language = 'ru' | 'en';

type Dictionary = {
  [key in Language]: {
    [key: string]: string;
  };
};

export const locales: Dictionary = {
  ru: {
    'nav.tab.home': 'Главная',
    'home.hero.title1': 'Ваш личный эксперт',
    'home.hero.title2': 'по сделкам в BSS',
    'home.hero.desc': 'Быстрый доступ к ценникам стикеров и ваучеров Bee Swarm Simulator. Сравнивайте предметы, рассчитывайте выгоду в калькуляторе и торгуйте с умом!',
    'home.btn.values': 'Проверить цены',
    'home.btn.calc': 'Калькулятор обменов',
    'home.features.title': 'Наши инструменты',
    'home.features.desc': 'Всё для трейдинга в одном месте',
    'home.features.catalog.title': 'Каталог цен',
    'home.features.catalog.desc': 'Цены, спрос и история для каждого предмета.',
    'home.features.calc.title': 'Калькулятор обменов',
    'home.features.calc.desc': 'Складывайте предметы с двух сторон и смотрите разницу в ценности.',
    'home.features.search.title': 'Быстрый поиск Ctrl+K',
    'home.features.search.desc': 'Ищите предметы по названию из любого места на сайте.',
    'home.popular.title': 'Популярные предметы',
    'nav.authors': 'Авторы',
    'nav.search': 'Быстрый поиск (Ctrl+K)',
    'nav.tab.catalog': 'Стикеры',
    'nav.tab.calculator': 'Калькулятор',
    'nav.tab.beequips': 'Биквипы',
    'hero.badge': 'Прайс-лист предметов Bee Swarm',
    'hero.title1': 'Ценность Стикеров &',
    'hero.title2': 'Ваучеров BSS',
    'hero.desc': 'Исследуйте актуальные расценки на все предметы из симулятора пчеловода. Добавляйте предметы в калькулятор сделок, чтобы оценить прибыльность вашего обмена.',
    'catalog.search.placeholder': 'Быстрый поиск стикера по названию...',
    'catalog.sort.label': 'Сортировка:',
    'catalog.sort.valDesc': 'По ценности (убыв.)',
    'catalog.sort.valAsc': 'По ценности (возр.)',
    'catalog.sort.demDesc': 'По спросу (хайп)',
    'catalog.sort.nameAsc': 'По названию (А-Я)',
    'catalog.filter.all': 'Все',
    'catalog.filter.label': 'Фильтр:',
    'catalog.empty': 'Предметы по вашему запросу не найдены.',
    'item.value': 'Ценность',
    'item.demand': 'Спрос',
    'item.stability': 'Стабильность',
    'item.stability.up': 'Растет',
    'item.stability.down': 'Падает',
    'item.stability.stable': 'Стабильно',
    'item.addA': 'Вам (А)',
    'item.addB': 'Им (Б)',
    'item.baseValue': 'Базовая ценность',
    'item.demandLevel': 'Уровень спроса',
    'item.desc': 'Описание предмета',
    'item.chart': 'Динамика изменения ценности (6 недель)',
    'calc.title': 'Калькулятор обменов BSS',
    'calc.clear': 'Очистить трейд',
    'calc.share.link': 'Ссылка',
    'calc.share.link.copied': 'Ссылка скопирована!',
    'calc.share.image': 'Скриншот',
    'calc.share.image.copied': 'Скриншот скопирован!',
    'calc.sideA': 'Сторона А (Вы отдаете)',
    'calc.sideA.badge': 'Отдача',
    'calc.sideB': 'Сторона Б (Вам отдают)',
    'calc.sideB.badge': 'Получение',
    'calc.emptySide': 'Выберите стикеры из списка в каталоге, чтобы добавить их сюда',
    'calc.total': 'Итоговая ценность:',
    'calc.verdict.title': 'Вердикт сделки',
    'calc.verdict.empty': 'Добавьте стикеры для оценки обмена',
    'calc.verdict.hugeLoss': 'Слив',
    'calc.verdict.loss': 'Убыточный трейд',
    'calc.verdict.fair': 'Честный трейд',
    'calc.verdict.win': 'Выгодный трейд',
    'calc.verdict.hugeWin': 'Огромный плюс',
    'calc.verdict.freeGain': 'Получаете бесплатную ценность',
    'calc.verdict.freeLoss': 'Вы отдаете предметы бесплатно',
    'calc.verdict.loseMsg': 'Вы теряете',
    'calc.verdict.fairMsg': 'Равный обмен (разница',
    'calc.verdict.winMsg': 'Прибыль',
    'calc.verdict.hugeWinMsg': 'Сверхприбыль',
    'authors.title': 'Авторы Проекта',
    'authors.role': 'Создатель BSS Index',
    'authors.desc': 'Автор проекта. Сделал сайт для отслеживания цен на стикеры и ваучеры и расчёта выгоды в обменах.',
    'authors.project': 'Проект',
    'authors.tech': 'Технологии',
    'authors.support': 'Поддержка',
    'authors.thanks': 'Для трейдеров Bee Swarm Simulator.',
    'settings.title': 'Настройки',
    'settings.theme': 'Тема',
    'settings.theme.dark': 'Тёмная',
    'settings.theme.light': 'Светлая',
    'settings.bg': 'Фон',
    'settings.bg.grid': 'Сетка',
    'settings.bg.dots': 'Точки',
    'settings.bg.gradient': 'Градиент',
    'settings.bg.solid': 'Гладкий',
    'settings.bg.waves': 'Волны',
    'settings.bg.hex': 'Соты',
    'settings.bg.aurora': 'Аврора',
    'settings.bg.carbon': 'Карбон',
    'settings.bg.custom': 'Свой фон',
    'settings.behavior': 'Поведение сайта',
    'settings.reduceMotion': 'Меньше анимаций',
    'settings.reduceMotionDesc': 'Отключает плавные переходы и анимации',
    'settings.weekBadges': 'Бейджи изменения цены',
    'settings.weekBadgesDesc': 'Показывать процент изменения за 7 дней на карточках',
    'settings.bgToggle': 'Фон',
    'settings.bgToggleDesc': 'Включить фоновый рисунок',
  },
  en: {
    'nav.tab.home': 'Home',
    'home.hero.title1': 'Your Personal Expert',
    'home.hero.title2': 'for BSS Trading',
    'home.hero.desc': 'Quick access to sticker and voucher values in Bee Swarm Simulator. Compare items, calculate profit in the trade calculator, and trade with confidence!',
    'home.btn.values': 'Check Values',
    'home.btn.calc': 'Trade Calculator',
    'home.features.title': 'Our Tools',
    'home.features.desc': 'Everything for trading in one place',
    'home.features.catalog.title': 'Price Catalog',
    'home.features.catalog.desc': 'Prices, demand, and history for every item.',
    'home.features.calc.title': 'Trade Calculator',
    'home.features.calc.desc': 'Add items on both sides and see the value difference.',
    'home.features.search.title': 'Quick Search (Ctrl+K)',
    'home.features.search.desc': 'Search items by name from anywhere on the site.',
    'home.popular.title': 'Popular Stickers',
    'nav.authors': 'Authors',
    'nav.search': 'Quick Search (Ctrl+K)',
    'nav.tab.catalog': 'Stickers',
    'nav.tab.calculator': 'Calculator',
    'nav.tab.beequips': 'Beequips',
    'hero.badge': 'Bee Swarm Items Value List',
    'hero.title1': 'Values of Stickers &',
    'hero.title2': 'BSS Vouchers',
    'hero.desc': 'Explore current prices for all items in Bee Swarm Simulator. Add items to the trade calculator to estimate the profitability of your trades.',
    'catalog.search.placeholder': 'Quick search for a sticker by name...',
    'catalog.sort.label': 'Sort by:',
    'catalog.sort.valDesc': 'Value (Desc)',
    'catalog.sort.valAsc': 'Value (Asc)',
    'catalog.sort.demDesc': 'Demand (Hype)',
    'catalog.sort.nameAsc': 'Name (A-Z)',
    'catalog.filter.all': 'All',
    'catalog.filter.label': 'Filter:',
    'catalog.empty': 'No items found matching your request.',
    'item.value': 'Value',
    'item.demand': 'Demand',
    'item.stability': 'Stability',
    'item.stability.up': 'Rising',
    'item.stability.down': 'Falling',
    'item.stability.stable': 'Stable',
    'item.addA': 'You Give (A)',
    'item.addB': 'They Give (B)',
    'item.baseValue': 'Base Value',
    'item.demandLevel': 'Demand Level',
    'item.desc': 'Item Description',
    'item.chart': 'Value Dynamics (6 weeks)',
    'calc.title': 'BSS Trade Calculator',
    'calc.clear': 'Clear Trade',
    'calc.share.link': 'Link',
    'calc.share.link.copied': 'Link Copied!',
    'calc.share.image': 'Screenshot',
    'calc.share.image.copied': 'Screenshot Copied!',
    'calc.sideA': 'Side A (You Give)',
    'calc.sideA.badge': 'Giving',
    'calc.sideB': 'Side B (They Give)',
    'calc.sideB.badge': 'Receiving',
    'calc.emptySide': 'Select stickers from the catalog list to add them here',
    'calc.total': 'Total Value:',
    'calc.verdict.title': 'Trade Verdict',
    'calc.verdict.empty': 'Add stickers to evaluate trade',
    'calc.verdict.hugeLoss': 'Huge L',
    'calc.verdict.loss': 'L Trade',
    'calc.verdict.fair': 'Fair Trade (F)',
    'calc.verdict.win': 'W Trade',
    'calc.verdict.hugeWin': 'Huge W',
    'calc.verdict.freeGain': 'Receiving free value',
    'calc.verdict.freeLoss': 'Giving items away for free',
    'calc.verdict.loseMsg': 'You lose',
    'calc.verdict.fairMsg': 'Equal exchange (difference',
    'calc.verdict.winMsg': 'Profit',
    'calc.verdict.hugeWinMsg': 'Massive Profit',
    'authors.title': 'Project Authors',
    'authors.role': 'Creator of BSS Index',
    'authors.desc': 'Project author. Built the site to track sticker and voucher prices and calculate trade profit.',
    'authors.project': 'Project',
    'authors.tech': 'Technology',
    'authors.support': 'Support',
    'authors.thanks': 'For Bee Swarm Simulator traders.',
    'settings.title': 'Settings',
    'settings.theme': 'Theme',
    'settings.theme.dark': 'Dark',
    'settings.theme.light': 'Light',
    'settings.bg': 'Background',
    'settings.bg.grid': 'Grid',
    'settings.bg.dots': 'Dots',
    'settings.bg.gradient': 'Gradient',
    'settings.bg.solid': 'Smooth',
    'settings.bg.waves': 'Waves',
    'settings.bg.hex': 'Honeycomb',
    'settings.bg.aurora': 'Aurora',
    'settings.bg.carbon': 'Carbon',
    'settings.bg.custom': 'Custom',
    'settings.behavior': 'Site Behavior',
    'settings.reduceMotion': 'Reduce Motion',
    'settings.reduceMotionDesc': 'Disables smooth transitions and animations',
    'settings.weekBadges': 'Price Change Badges',
    'settings.weekBadgesDesc': 'Show 7-day change percentage on cards',
    'settings.bgToggle': 'Background',
    'settings.bgToggleDesc': 'Enable background pattern',
  }
};

export function t(key: string, lang: Language): string {
  return locales[lang]?.[key] || key;
}

export function translateDemand(demand: string, lang: Language): string {
  if (lang === 'ru') return demand;
  switch (demand) {
    case 'Хайп': return 'Hype';
    case 'Высокий': return 'High';
    case 'Средний': return 'Average';
    case 'Низкий': return 'Low';
    default: return demand;
  }
}

export function translateStability(stability: string, lang: Language): string {
  if (lang === 'ru') return stability;
  switch (stability) {
    case 'Растет': return 'Rising';
    case 'Падает': return 'Falling';
    case 'Стабильно': return 'Stable';
    default: return stability;
  }
}

export function translateCategory(cat: string, lang: Language): string {
  if (lang === 'ru') return cat;
  switch (cat) {
    case 'Все': return 'All';
    case 'Скины на каба':
    case 'Скины на куба': return 'Cub Skins';
    case 'Скины на улей': return 'Hive Skins';
    case 'Ваучеры': return 'Vouchers';
    case 'Стикеры пчел': return 'Bee Stickers';
    case 'Стикеры медведей': return 'Bear Stickers';
    case 'Стикеры мобов': return 'Mob Stickers';
    case 'Искусство': return 'Art';
    case 'Драгоценности': return 'Gems';
    case 'Иконки нектара': return 'Nectar Icons';
    case 'Цветы': return 'Flowers';
    case 'Грибы': return 'Mushrooms';
    case 'Листья': return 'Leaves';
    case 'Инструменты': return 'Tools';
    case 'Марки': return 'Stamps';
    case 'Стикеры Пчелождества': return 'Beesmas Stickers';
    case 'Разное': return 'Misc';
    case 'Звездные знаки': return 'Star Signs';
    case 'Стикеры полей': return 'Field Stickers';
    case 'Биквипы': return 'Beequips';
    default: return cat;
  }
}

