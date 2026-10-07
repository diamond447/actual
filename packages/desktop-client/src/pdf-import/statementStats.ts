import type { ImportTransactionEntity } from '@actual-app/core/types/models';

/**
 * Compare the imported total with the balances printed on the statement.
 * All amounts are integers (e.g. haléře).
 */
export function checkStatementTotal({
  openingBalance,
  closingBalance,
  total,
}: {
  openingBalance: number | null;
  closingBalance: number | null;
  total: number;
}): { expected: number; difference: number } | null {
  if (openingBalance === null || closingBalance === null) {
    return null;
  }
  const expected = closingBalance - openingBalance;
  return { expected, difference: expected - total };
}

export type CategoryShare = {
  categoryId: string | null;
  amount: number;
  /** Share of all expenses, 0–1 */
  share: number;
};

export type StatementStats = {
  count: number;
  income: number;
  expenses: number;
  firstDate: string | null;
  lastDate: string | null;
  /** Expenses by category, largest first (amounts are positive) */
  expensesByCategory: CategoryShare[];
  /** Payees with the largest expenses (amounts are positive) */
  topPayees: Array<{ name: string; amount: number; count: number }>;
};

/** Statistics of the transactions imported from one statement. */
export function statementStats(
  transactions: Pick<
    ImportTransactionEntity,
    'date' | 'amount' | 'category' | 'payee_name'
  >[],
  { topPayeeCount = 5 } = {},
): StatementStats {
  let income = 0;
  let expenses = 0;
  const byCategory = new Map<string | null, number>();
  const byPayee = new Map<string, { amount: number; count: number }>();
  const dates = transactions.map(transaction => transaction.date).sort();

  for (const transaction of transactions) {
    const amount = transaction.amount ?? 0;
    if (amount >= 0) {
      income += amount;
      continue;
    }
    expenses += -amount;
    const category = transaction.category ?? null;
    byCategory.set(category, (byCategory.get(category) ?? 0) - amount);
    const name = transaction.payee_name || '';
    const payee = byPayee.get(name) ?? { amount: 0, count: 0 };
    byPayee.set(name, {
      amount: payee.amount - amount,
      count: payee.count + 1,
    });
  }

  return {
    count: transactions.length,
    income,
    expenses,
    firstDate: dates[0] ?? null,
    lastDate: dates[dates.length - 1] ?? null,
    expensesByCategory: [...byCategory]
      .map(([categoryId, amount]) => ({
        categoryId,
        amount,
        share: expenses === 0 ? 0 : amount / expenses,
      }))
      .sort((a, b) => b.amount - a.amount),
    topPayees: [...byPayee]
      .filter(([name]) => name !== '')
      .map(([name, { amount, count }]) => ({ name, amount, count }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, topPayeeCount),
  };
}
