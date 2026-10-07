import { checkStatementTotal, statementStats } from './statementStats';

describe('checkStatementTotal', () => {
  it('reports the difference to the printed balances', () => {
    expect(
      checkStatementTotal({
        openingBalance: 1000000,
        closingBalance: 991100,
        total: -8900,
      }),
    ).toEqual({ expected: -8900, difference: 0 });
    expect(
      checkStatementTotal({
        openingBalance: 1000000,
        closingBalance: 841100,
        total: -8900,
      }),
    ).toEqual({ expected: -158900, difference: -150000 });
  });

  it('cannot check without both balances', () => {
    expect(
      checkStatementTotal({
        openingBalance: null,
        closingBalance: 100,
        total: 0,
      }),
    ).toBeNull();
  });
});

describe('statementStats', () => {
  it('sums income and expenses by category and payee', () => {
    const stats = statementStats([
      {
        date: '2026-09-03',
        amount: -30000,
        category: 'food',
        payee_name: 'Albert',
      },
      {
        date: '2026-09-01',
        amount: -10000,
        category: 'food',
        payee_name: 'Albert',
      },
      { date: '2026-09-02', amount: -60000, payee_name: 'Nájem' },
      { date: '2026-09-15', amount: 4235000, payee_name: 'Výplata' },
    ]);

    expect(stats).toEqual({
      count: 4,
      income: 4235000,
      expenses: 100000,
      firstDate: '2026-09-01',
      lastDate: '2026-09-15',
      expensesByCategory: [
        { categoryId: null, amount: 60000, share: 0.6 },
        { categoryId: 'food', amount: 40000, share: 0.4 },
      ],
      topPayees: [
        { name: 'Nájem', amount: 60000, count: 1 },
        { name: 'Albert', amount: 40000, count: 2 },
      ],
    });
  });
});
