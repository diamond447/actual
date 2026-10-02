import { toImportTransactions, toStatementRows } from './toImportTransactions';

const parsed = [
  {
    date: '2026-09-01',
    amount: -487.3,
    payee: 'Albert',
    notes: 'PLATBA KARTOU · Albert',
    reviewReasons: [],
  },
  {
    date: '2026-09-03',
    amount: null,
    payee: 'Nájem',
    notes: 'Nájem',
    reviewReasons: ['missing-amount' as const],
  },
];

describe('toImportTransactions', () => {
  it('selects only rows with a reliable amount', () => {
    const uncertain = {
      ...parsed[0],
      reviewReasons: ['uncertain-amount' as const],
    };
    expect(
      toStatementRows([...parsed, uncertain]).map(row => row.isSelected),
    ).toEqual([true, false, false]);
  });

  it('converts selected rows to import transactions', () => {
    const rows = toStatementRows(parsed);
    expect(toImportTransactions(rows, 'account-1')).toEqual([
      {
        account: 'account-1',
        date: '2026-09-01',
        amount: -48730,
        payee_name: 'Albert',
        imported_payee: 'Albert',
        imported_id: 'pdf:2026-09-01:-48730:albert:0',
        notes: 'PLATBA KARTOU · Albert',
        cleared: true,
      },
    ]);
  });

  it('includes filled-in amounts and can flip signs', () => {
    const rows = toStatementRows(parsed).map(row =>
      row.amount === null
        ? { ...row, amount: -15000, isSelected: true, isAmountManual: true }
        : row,
    );
    expect(
      toImportTransactions(rows, 'account-1', { flipSigns: true }).map(
        transaction => transaction.amount,
      ),
    ).toEqual([48730, -1500000]);
  });

  it('gives identical rows different ids and keeps categories', () => {
    const rows = toStatementRows([parsed[0], parsed[0]]).map((row, index) =>
      index === 1 ? { ...row, category: 'groceries' } : row,
    );
    expect(
      toImportTransactions(rows, 'account-1').map(transaction => [
        transaction.imported_id,
        transaction.category,
      ]),
    ).toEqual([
      ['pdf:2026-09-01:-48730:albert:0', undefined],
      ['pdf:2026-09-01:-48730:albert:1', 'groceries'],
    ]);
  });
});
