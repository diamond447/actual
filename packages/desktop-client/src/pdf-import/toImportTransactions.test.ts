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
  it('selects only rows with an amount', () => {
    expect(toStatementRows(parsed).map(row => row.isSelected)).toEqual([
      true,
      false,
    ]);
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
        notes: 'PLATBA KARTOU · Albert',
        cleared: true,
      },
    ]);
  });

  it('includes filled-in amounts and can flip signs', () => {
    const rows = toStatementRows(parsed).map(row =>
      row.amount === null ? { ...row, amount: 15000, isSelected: true } : row,
    );
    expect(
      toImportTransactions(rows, 'account-1', { flipSigns: true }).map(
        transaction => transaction.amount,
      ),
    ).toEqual([48730, -1500000]);
  });
});
