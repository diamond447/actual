import { CATEGORY_COLOR_IDS } from './categoryColors';
import type { CategoryColorId } from './categoryColors';
import type { CategoryIconId } from './icons';

export function normalizeCategoryName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getDeterministicColor(seed: string): CategoryColorId {
  const index = hashString(seed) % CATEGORY_COLOR_IDS.length;
  return CATEGORY_COLOR_IDS[index];
}

type AppearanceRule = {
  icon: CategoryIconId;
  color: CategoryColorId;
  keywords: string[];
};

// Evaluated in order: more specific phrases should precede general keywords.
const RULES: AppearanceRule[] = [
  // Salary / Wages
  {
    icon: 'salary',
    color: 'teal',
    keywords: ['vyplata', 'mzda', 'plat', 'salary', 'paycheck', 'wage'],
  },
  // Income
  {
    icon: 'wallet',
    color: 'teal',
    keywords: ['prijem', 'income'],
  },
  // Restaurants & Dining out
  {
    icon: 'restaurant',
    color: 'orange',
    keywords: [
      'jidlo venku',
      'restaurace',
      'restaurant',
      'dining',
      'obed',
      'vecere',
      'bistro',
    ],
  },
  // Coffee
  {
    icon: 'coffee',
    color: 'amber',
    keywords: ['kavarna', 'kava', 'coffee', 'cafe', 'espresso'],
  },
  // Groceries & Food
  {
    icon: 'cart',
    color: 'green',
    keywords: [
      'potraviny',
      'groceries',
      'grocery',
      'supermarket',
      'food',
      'jidlo',
      'nakup',
    ],
  },
  // Housing / Rent / Mortgage
  {
    icon: 'home',
    color: 'blue',
    keywords: [
      'bydleni',
      'najem',
      'hypoteka',
      'rent',
      'housing',
      'mortgage',
      'domov',
    ],
  },
  // Repairs / Maintenance
  {
    icon: 'repair',
    color: 'slate',
    keywords: ['opravy', 'oprava', 'udrzba', 'repairs', 'repair', 'servis'],
  },
  // Utilities & Energy
  {
    icon: 'bolt',
    color: 'olive',
    keywords: [
      'energie',
      'elektrina',
      'plyn',
      'utilities',
      'utility',
      'electric',
      'electricity',
      'gas',
      'power',
    ],
  },
  // Water
  {
    icon: 'water',
    color: 'teal',
    keywords: ['voda', 'water', 'vodne', 'stocne'],
  },
  // Public transport
  {
    icon: 'bus',
    color: 'amber',
    keywords: [
      'public transport',
      'doprava',
      'mhd',
      'transport',
      'autobus',
      'tramvaj',
      'metro',
      'vlak',
      'bus',
    ],
  },
  // Fuel / Gas station
  {
    icon: 'fuel',
    color: 'amber',
    keywords: ['benzin', 'palivo', 'fuel', 'nafta', 'cerpaci stanice'],
  },
  // Car
  {
    icon: 'car',
    color: 'blue',
    keywords: ['auto', 'car', 'vozidlo', 'automobil'],
  },
  // Travel & Vacation
  {
    icon: 'plane',
    color: 'blue',
    keywords: [
      'cestovani',
      'dovolena',
      'travel',
      'vacation',
      'letenky',
      'flight',
      'plane',
      'zajezd',
    ],
  },
  // Pharmacy & Medications
  {
    icon: 'pill',
    color: 'red',
    keywords: ['lekarna', 'leky', 'lek', 'pharmacy', 'pill', 'medicine'],
  },
  // Health & Medical
  {
    icon: 'heart',
    color: 'pink',
    keywords: [
      'zdravi',
      'lekar',
      'doktor',
      'health',
      'medical',
      'doctor',
      'ordinace',
    ],
  },
  // Sport & Fitness
  {
    icon: 'sport',
    color: 'green',
    keywords: ['sport', 'fitness', 'gym', 'posilovna', 'cviceni'],
  },
  // Beauty & Cosmetics
  {
    icon: 'beauty',
    color: 'pink',
    keywords: ['kosmetika', 'kadernik', 'beauty', 'holic', 'salon'],
  },
  // Entertainment & Fun
  {
    icon: 'ticket',
    color: 'purple',
    keywords: [
      'zabava',
      'entertainment',
      'fun',
      'ticket',
      'tickets',
      'listky',
      'vstupenky',
    ],
  },
  // Games
  {
    icon: 'game',
    color: 'purple',
    keywords: [
      'hry',
      'hra',
      'games',
      'game',
      'gaming',
      'playstation',
      'xbox',
      'steam',
    ],
  },
  // Music
  {
    icon: 'music',
    color: 'purple',
    keywords: ['hudba', 'music', 'spotify', 'koncert'],
  },
  // Movies & Cinema & Streaming
  {
    icon: 'film',
    color: 'red',
    keywords: [
      'kino',
      'filmy',
      'film',
      'movies',
      'movie',
      'cinema',
      'streaming',
      'netflix',
      'hbo',
    ],
  },
  // Clothing
  {
    icon: 'shirt',
    color: 'slate',
    keywords: ['obleceni', 'clothing', 'clothes', 'shirt', 'saty', 'moda'],
  },
  // Gifts
  {
    icon: 'gift',
    color: 'pink',
    keywords: ['darky', 'darek', 'gift', 'gifts'],
  },
  // Education & School & Books
  {
    icon: 'book',
    color: 'blue',
    keywords: [
      'vzdelani',
      'skola',
      'kurzy',
      'kurz',
      'education',
      'book',
      'books',
      'kniha',
      'knihy',
    ],
  },
  // Kids
  {
    icon: 'kids',
    color: 'amber',
    keywords: ['deti', 'dite', 'kids', 'children', 'child', 'baby', 'miminko'],
  },
  // Pets & Animals
  {
    icon: 'pet',
    color: 'amber',
    keywords: [
      'zvirata',
      'zvire',
      'mazlicek',
      'pets',
      'pet',
      'pes',
      'kocka',
      'veterinar',
    ],
  },
  // Phone
  {
    icon: 'phone',
    color: 'slate',
    keywords: ['telefon', 'mobil', 'phone', 'mobile', 'pausal'],
  },
  // Internet & WiFi
  {
    icon: 'wifi',
    color: 'blue',
    keywords: ['internet', 'wifi', 'broadband'],
  },
  // Subscriptions & Bills
  {
    icon: 'receipt',
    color: 'slate',
    keywords: [
      'predplatne',
      'poplatky',
      'subscriptions',
      'subscription',
      'bills',
      'bill',
      'slozenky',
      'ucty',
    ],
  },
  // Insurance
  {
    icon: 'shield',
    color: 'blue',
    keywords: ['pojisteni', 'insurance', 'pojistka', 'shield'],
  },
  // Savings & Investments
  {
    icon: 'piggy',
    color: 'green',
    keywords: [
      'sporeni',
      'savings',
      'saving',
      'investice',
      'investments',
      'investment',
      'uspory',
    ],
  },
  // Cash
  {
    icon: 'cash',
    color: 'green',
    keywords: ['hotovost', 'cash', 'penize'],
  },
];

function matchesKeyword(normalizedText: string, keyword: string): boolean {
  if (keyword.includes(' ')) {
    return normalizedText.includes(keyword);
  }
  // Word boundary match or match within punctuation/token boundaries
  const regex = new RegExp(`(^|[^a-z0-9])${keyword}([^a-z0-9]|$)`, 'i');
  return regex.test(normalizedText);
}

export function guessCategoryAppearance(
  name: string,
  seed?: string,
): { icon: CategoryIconId; color: CategoryColorId } {
  const normalized = normalizeCategoryName(name);

  if (normalized) {
    for (const rule of RULES) {
      for (const keyword of rule.keywords) {
        if (matchesKeyword(normalized, keyword)) {
          return { icon: rule.icon, color: rule.color };
        }
      }
    }
  }

  const fallbackKey = seed ?? name;
  return {
    icon: 'tag',
    color: getDeterministicColor(fallbackKey),
  };
}
