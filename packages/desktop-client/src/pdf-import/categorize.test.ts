import { findPayeeId, guessCategoryId, suggestCategories } from './categorize';
import { toStatementRows } from './toImportTransactions';

const categories = [
  { id: 'groceries', name: 'Potraviny', hidden: false },
  { id: 'dining', name: 'Restaurace', hidden: false },
  { id: 'fun', name: 'Entertainment', hidden: false },
  { id: 'old', name: 'Doprava', hidden: true },
];

describe('guessCategoryId', () => {
  it('maps well-known merchants to existing categories', () => {
    expect(guessCategoryId('ALBERT HM PRAHA 4', categories)).toBe('groceries');
    expect(guessCategoryId('Bistro Na Rohu', categories)).toBe('dining');
    expect(guessCategoryId('Spotify P2B4C8', categories)).toBe('fun');
  });

  it('returns null without a fitting or visible category', () => {
    expect(guessCategoryId('Pronajímatel Novák', categories)).toBeNull();
    expect(guessCategoryId('Benzina Brno', categories)).toBeNull();
  });
});

describe('findPayeeId', () => {
  const payees = [
    { id: 'p1', name: 'Albert' },
    { id: 'p2', name: 'Spořicí účet', transfer_acct: 'acct' },
  ];

  it('finds a payee by name ignoring case and accents', () => {
    expect(findPayeeId('ALBERT', payees)).toBe('p1');
    expect(findPayeeId('Sporici ucet', payees)).toBeNull();
    expect(findPayeeId('', payees)).toBeNull();
  });
});

describe('suggestCategories', () => {
  const rows = toStatementRows(
    ['ALBERT', 'Lékárna', 'Bistro'].map(payee => ({
      date: '2026-09-01',
      amount: -100,
      payee,
      notes: payee,
      reviewReasons: [],
    })),
  );

  it('prefers rules, then known merchants, and keeps user choices', async () => {
    const result = await suggestCategories(
      rows.map(row =>
        row.payee === 'Bistro'
          ? { ...row, category: 'fun', categorySource: 'user' as const }
          : row,
      ),
      {
        accountId: 'account-1',
        categories,
        payees: [],
        runRules: async transaction => ({
          ...transaction,
          category:
            transaction.imported_payee === 'ALBERT' ? 'dining' : undefined,
        }),
      },
    );

    expect(result.map(row => [row.category, row.categorySource])).toEqual([
      ['dining', 'rule'],
      [null, undefined],
      ['fun', 'user'],
    ]);
  });
});
