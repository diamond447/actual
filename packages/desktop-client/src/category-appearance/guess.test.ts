import { describe, expect, it } from 'vitest';

import { CATEGORY_COLOR_IDS } from './categoryColors';
import {
  getDeterministicColor,
  guessCategoryAppearance,
  normalizeCategoryName,
} from './guess';

describe('normalizeCategoryName', () => {
  it('strips Czech diacritics and converts to lowercase', () => {
    expect(normalizeCategoryName('Příliš žluťoučký kůň')).toBe(
      'prilis zlutoucky kun',
    );
    expect(normalizeCategoryName('  JÍDLO VENKU  ')).toBe('jidlo venku');
  });
});

describe('guessCategoryAppearance - Czech keywords', () => {
  const czechCases = [
    { name: 'Potraviny', icon: 'cart', color: 'green' },
    { name: 'supermarket', icon: 'cart', color: 'green' },
    { name: 'jídlo venku', icon: 'restaurant', color: 'orange' },
    { name: 'Restaurace', icon: 'restaurant', color: 'orange' },
    { name: 'kavárna', icon: 'coffee', color: 'amber' },
    { name: 'Bydlení', icon: 'home', color: 'blue' },
    { name: 'nájem', icon: 'home', color: 'blue' },
    { name: 'hypotéka', icon: 'home', color: 'blue' },
    { name: 'Opravy', icon: 'repair', color: 'slate' },
    { name: 'údržba', icon: 'repair', color: 'slate' },
    { name: 'energie', icon: 'bolt', color: 'olive' },
    { name: 'elektřina', icon: 'bolt', color: 'olive' },
    { name: 'plyn', icon: 'bolt', color: 'olive' },
    { name: 'voda', icon: 'water', color: 'teal' },
    { name: 'doprava', icon: 'bus', color: 'amber' },
    { name: 'MHD', icon: 'bus', color: 'amber' },
    { name: 'auto', icon: 'car', color: 'blue' },
    { name: 'benzín', icon: 'fuel', color: 'amber' },
    { name: 'palivo', icon: 'fuel', color: 'amber' },
    { name: 'cestování', icon: 'plane', color: 'blue' },
    { name: 'dovolená', icon: 'plane', color: 'blue' },
    { name: 'zdraví', icon: 'heart', color: 'pink' },
    { name: 'lékař', icon: 'heart', color: 'pink' },
    { name: 'lékárna', icon: 'pill', color: 'red' },
    { name: 'léky', icon: 'pill', color: 'red' },
    { name: 'sport', icon: 'sport', color: 'green' },
    { name: 'kosmetika', icon: 'beauty', color: 'pink' },
    { name: 'kadeřník', icon: 'beauty', color: 'pink' },
    { name: 'zábava', icon: 'ticket', color: 'purple' },
    { name: 'hry', icon: 'game', color: 'purple' },
    { name: 'hudba', icon: 'music', color: 'purple' },
    { name: 'kino', icon: 'film', color: 'red' },
    { name: 'filmy', icon: 'film', color: 'red' },
    { name: 'oblečení', icon: 'shirt', color: 'slate' },
    { name: 'dárky', icon: 'gift', color: 'pink' },
    { name: 'vzdělání', icon: 'book', color: 'blue' },
    { name: 'škola', icon: 'book', color: 'blue' },
    { name: 'kurzy', icon: 'book', color: 'blue' },
    { name: 'děti', icon: 'kids', color: 'amber' },
    { name: 'zvířata', icon: 'pet', color: 'amber' },
    { name: 'mazlíček', icon: 'pet', color: 'amber' },
    { name: 'telefon', icon: 'phone', color: 'slate' },
    { name: 'mobil', icon: 'phone', color: 'slate' },
    { name: 'internet', icon: 'wifi', color: 'blue' },
    { name: 'předplatné', icon: 'receipt', color: 'slate' },
    { name: 'poplatky', icon: 'receipt', color: 'slate' },
    { name: 'pojištění', icon: 'shield', color: 'blue' },
    { name: 'spoření', icon: 'piggy', color: 'green' },
    { name: 'investice', icon: 'piggy', color: 'green' },
    { name: 'příjem', icon: 'wallet', color: 'teal' },
    { name: 'výplata', icon: 'salary', color: 'teal' },
    { name: 'mzda', icon: 'salary', color: 'teal' },
    { name: 'plat', icon: 'salary', color: 'teal' },
    { name: 'hotovost', icon: 'cash', color: 'green' },
  ] as const;

  for (const tc of czechCases) {
    it(`identifies "${tc.name}" -> ${tc.icon} + ${tc.color}`, () => {
      const result = guessCategoryAppearance(tc.name);
      expect(result.icon).toBe(tc.icon);
      expect(result.color).toBe(tc.color);
    });
  }
});

describe('guessCategoryAppearance - English keywords', () => {
  const englishCases = [
    { name: 'Groceries', icon: 'cart', color: 'green' },
    { name: 'Food', icon: 'cart', color: 'green' },
    { name: 'Restaurant', icon: 'restaurant', color: 'orange' },
    { name: 'Dining', icon: 'restaurant', color: 'orange' },
    { name: 'Coffee', icon: 'coffee', color: 'amber' },
    { name: 'Rent', icon: 'home', color: 'blue' },
    { name: 'Housing', icon: 'home', color: 'blue' },
    { name: 'Mortgage', icon: 'home', color: 'blue' },
    { name: 'Repairs', icon: 'repair', color: 'slate' },
    { name: 'Utilities', icon: 'bolt', color: 'olive' },
    { name: 'Electric', icon: 'bolt', color: 'olive' },
    { name: 'Gas', icon: 'bolt', color: 'olive' },
    { name: 'Water', icon: 'water', color: 'teal' },
    { name: 'Transport', icon: 'bus', color: 'amber' },
    { name: 'Public transport', icon: 'bus', color: 'amber' },
    { name: 'Car', icon: 'car', color: 'blue' },
    { name: 'Fuel', icon: 'fuel', color: 'amber' },
    { name: 'Travel', icon: 'plane', color: 'blue' },
    { name: 'Vacation', icon: 'plane', color: 'blue' },
    { name: 'Health', icon: 'heart', color: 'pink' },
    { name: 'Medical', icon: 'heart', color: 'pink' },
    { name: 'Pharmacy', icon: 'pill', color: 'red' },
    { name: 'Fitness', icon: 'sport', color: 'green' },
    { name: 'Gym', icon: 'sport', color: 'green' },
    { name: 'Beauty', icon: 'beauty', color: 'pink' },
    { name: 'Entertainment', icon: 'ticket', color: 'purple' },
    { name: 'Fun', icon: 'ticket', color: 'purple' },
    { name: 'Games', icon: 'game', color: 'purple' },
    { name: 'Music', icon: 'music', color: 'purple' },
    { name: 'Streaming', icon: 'film', color: 'red' },
    { name: 'Clothing', icon: 'shirt', color: 'slate' },
    { name: 'Gift', icon: 'gift', color: 'pink' },
    { name: 'Education', icon: 'book', color: 'blue' },
    { name: 'Kids', icon: 'kids', color: 'amber' },
    { name: 'Children', icon: 'kids', color: 'amber' },
    { name: 'Pets', icon: 'pet', color: 'amber' },
    { name: 'Phone', icon: 'phone', color: 'slate' },
    { name: 'Wifi', icon: 'wifi', color: 'blue' },
    { name: 'Subscriptions', icon: 'receipt', color: 'slate' },
    { name: 'Bills', icon: 'receipt', color: 'slate' },
    { name: 'Insurance', icon: 'shield', color: 'blue' },
    { name: 'Savings', icon: 'piggy', color: 'green' },
    { name: 'Income', icon: 'wallet', color: 'teal' },
    { name: 'Salary', icon: 'salary', color: 'teal' },
    { name: 'Paycheck', icon: 'salary', color: 'teal' },
    { name: 'Cash', icon: 'cash', color: 'green' },
  ] as const;

  for (const tc of englishCases) {
    it(`identifies "${tc.name}" -> ${tc.icon} + ${tc.color}`, () => {
      const result = guessCategoryAppearance(tc.name);
      expect(result.icon).toBe(tc.icon);
      expect(result.color).toBe(tc.color);
    });
  }
});

describe('guessCategoryAppearance - deterministic fallback', () => {
  it('falls back to tag icon when no keywords match', () => {
    const res = guessCategoryAppearance('Miscellaneous Stuff');
    expect(res.icon).toBe('tag');
    expect(CATEGORY_COLOR_IDS).toContain(res.color);
  });

  it('produces the exact same color for the same category name', () => {
    const res1 = guessCategoryAppearance('Some Unique Unmatched Name');
    const res2 = guessCategoryAppearance('Some Unique Unmatched Name');
    expect(res1).toEqual(res2);
  });

  it('uses the seed parameter deterministically when provided', () => {
    const seed = 'cat-uuid-12345';
    const res = guessCategoryAppearance('Unmatched Category', seed);
    expect(res.icon).toBe('tag');
    expect(res.color).toBe(getDeterministicColor(seed));
  });

  it('handles empty and whitespace strings safely', () => {
    const res1 = guessCategoryAppearance('');
    expect(res1.icon).toBe('tag');
    const res2 = guessCategoryAppearance('    ');
    expect(res2.icon).toBe('tag');
  });
});
