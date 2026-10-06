import type {
  AccountEntity,
  CategoryEntity,
  PayeeEntity,
  TransactionEntity,
} from '@actual-app/core/types/models';
import { enUS } from 'date-fns/locale';
import { describe, expect, it } from 'vitest';

import {
  calculateMonthTotals,
  filterTransactions,
  formatCategoryAndNotes,
  formatDayHeader,
  getCategoryDisplay,
  getPayeeDisplay,
  getRowTexts,
  groupTransactionsByDay,
  matchesFilterType,
  matchesSearch,
} from './transactionsFeedHelper';

describe('transactionsFeedHelper', () => {
  const mockCategories: Record<string, CategoryEntity> = {
    c1: { id: 'c1', name: 'Food & Dining', is_income: false } as CategoryEntity,
    c2: { id: 'c2', name: 'Salary', is_income: true } as CategoryEntity,
    c3: { id: 'c3', name: 'Café & Thé', is_income: false } as CategoryEntity,
  };

  const mockPayees: Record<string, PayeeEntity> = {
    p1: { id: 'p1', name: 'Supermarket' } as PayeeEntity,
    p2: {
      id: 'p2',
      name: 'Transfer Payee',
      transfer_acct: 'a2',
    } as PayeeEntity,
    p3: { id: 'p3', name: 'Crème Brûlée Bakery' } as PayeeEntity,
  };

  const mockAccounts: Record<string, AccountEntity> = {
    a1: {
      id: 'a1',
      name: 'Checking',
      offbudget: 0,
    } as unknown as AccountEntity,
    a2: {
      id: 'a2',
      name: 'Savings Account',
      offbudget: 0,
    } as unknown as AccountEntity,
  };

  const context = {
    categoriesById: mockCategories,
    payeesById: mockPayees,
    accountsById: mockAccounts,
  };

  describe('getPayeeDisplay', () => {
    it('returns payee name when payee exists', () => {
      const t: TransactionEntity = {
        id: 't1',
        account: 'a1',
        amount: -5000,
        date: '2026-10-01',
        payee: 'p1',
      };
      expect(getPayeeDisplay(t, mockPayees, mockAccounts)).toBe('Supermarket');
    });

    it('returns transfer account name for transfer payee', () => {
      const t: TransactionEntity = {
        id: 't1',
        account: 'a1',
        amount: -5000,
        date: '2026-10-01',
        payee: 'p2',
      };
      expect(getPayeeDisplay(t, mockPayees, mockAccounts)).toBe(
        'Savings Account',
      );
    });

    it('handles new: prefix', () => {
      const t: TransactionEntity = {
        id: 't1',
        account: 'a1',
        amount: -5000,
        date: '2026-10-01',
        payee: 'new:Custom Store',
      };
      expect(getPayeeDisplay(t, mockPayees, mockAccounts)).toBe('Custom Store');
    });

    it('falls back to imported_payee if no payee id', () => {
      const t: TransactionEntity = {
        id: 't1',
        account: 'a1',
        amount: -5000,
        date: '2026-10-01',
        imported_payee: 'CARD PAYMENT 1234',
      };
      expect(getPayeeDisplay(t, mockPayees, mockAccounts)).toBe(
        'CARD PAYMENT 1234',
      );
    });

    it('falls back to (No payee)', () => {
      const t: TransactionEntity = {
        id: 't1',
        account: 'a1',
        amount: -5000,
        date: '2026-10-01',
      };
      expect(getPayeeDisplay(t, mockPayees, mockAccounts)).toBe('(No payee)');
    });
  });

  describe('getCategoryDisplay', () => {
    it('returns category name when category exists', () => {
      const t: TransactionEntity = {
        id: 't1',
        account: 'a1',
        amount: -2500,
        date: '2026-10-01',
        category: 'c1',
      };
      const res = getCategoryDisplay(t, mockCategories);
      expect(res.name).toBe('Food & Dining');
      expect(res.isSplit).toBe(false);
      expect(res.isUncategorized).toBe(false);
    });

    it('detects split transactions', () => {
      const t: TransactionEntity = {
        id: 't1',
        account: 'a1',
        amount: -2500,
        date: '2026-10-01',
        is_parent: true,
      };
      const res = getCategoryDisplay(t, mockCategories);
      expect(res.name).toBe('Split');
      expect(res.isSplit).toBe(true);
      expect(res.isUncategorized).toBe(false);
    });

    it('detects uncategorized transactions', () => {
      const t: TransactionEntity = {
        id: 't1',
        account: 'a1',
        amount: -2500,
        date: '2026-10-01',
      };
      const res = getCategoryDisplay(t, mockCategories);
      expect(res.name).toBe('Uncategorized');
      expect(res.isSplit).toBe(false);
      expect(res.isUncategorized).toBe(true);
    });
  });

  describe('formatCategoryAndNotes', () => {
    it('formats category and notes combined', () => {
      expect(formatCategoryAndNotes('Food', 'Lunch with team')).toBe(
        'Food · Lunch with team',
      );
    });

    it('returns only category if notes empty', () => {
      expect(formatCategoryAndNotes('Food', '')).toBe('Food');
      expect(formatCategoryAndNotes('Food', undefined)).toBe('Food');
    });

    it('returns only notes if category empty', () => {
      expect(formatCategoryAndNotes('', 'Lunch')).toBe('Lunch');
    });
  });

  describe('matchesSearch', () => {
    it('matches case- and diacritics-insensitively on payee', () => {
      const t: TransactionEntity = {
        id: 't1',
        account: 'a1',
        amount: -1000,
        date: '2026-10-01',
        payee: 'p3', // Crème Brûlée Bakery
      };
      expect(matchesSearch(t, 'creme', context)).toBe(true);
      expect(matchesSearch(t, 'BRULEE', context)).toBe(true);
      expect(matchesSearch(t, 'bakery', context)).toBe(true);
      expect(matchesSearch(t, 'pizza', context)).toBe(false);
    });

    it('matches on category', () => {
      const t: TransactionEntity = {
        id: 't1',
        account: 'a1',
        amount: -1000,
        date: '2026-10-01',
        category: 'c3', // Café & Thé
      };
      expect(matchesSearch(t, 'cafe', context)).toBe(true);
      expect(matchesSearch(t, 'the', context)).toBe(true);
    });

    it('matches on notes', () => {
      const t: TransactionEntity = {
        id: 't1',
        account: 'a1',
        amount: -1000,
        date: '2026-10-01',
        notes: 'Chèque cadeau',
      };
      expect(matchesSearch(t, 'cheque', context)).toBe(true);
      expect(matchesSearch(t, 'cadeau', context)).toBe(true);
    });

    it('matches on subtransactions', () => {
      const t: TransactionEntity = {
        id: 't1',
        account: 'a1',
        amount: -5000,
        date: '2026-10-01',
        is_parent: true,
        subtransactions: [
          {
            id: 't1_sub1',
            account: 'a1',
            amount: -2000,
            date: '2026-10-01',
            category: 'c1', // Food & Dining
            notes: 'Sub note',
          },
        ],
      };
      expect(matchesSearch(t, 'food', context)).toBe(true);
      expect(matchesSearch(t, 'sub note', context)).toBe(true);
    });
  });

  describe('matchesFilterType', () => {
    const expense: TransactionEntity = {
      id: 'e',
      account: 'a1',
      amount: -1000,
      date: '2026-10-01',
    };
    const income: TransactionEntity = {
      id: 'i',
      account: 'a1',
      amount: 2000,
      date: '2026-10-01',
    };
    const zero: TransactionEntity = {
      id: 'z',
      account: 'a1',
      amount: 0,
      date: '2026-10-01',
    };

    it('matches all', () => {
      expect(matchesFilterType(expense, 'all')).toBe(true);
      expect(matchesFilterType(income, 'all')).toBe(true);
      expect(matchesFilterType(zero, 'all')).toBe(true);
    });

    it('matches expenses', () => {
      expect(matchesFilterType(expense, 'expenses')).toBe(true);
      expect(matchesFilterType(income, 'expenses')).toBe(false);
      expect(matchesFilterType(zero, 'expenses')).toBe(false);
    });

    it('matches income', () => {
      expect(matchesFilterType(expense, 'income')).toBe(false);
      expect(matchesFilterType(income, 'income')).toBe(true);
      expect(matchesFilterType(zero, 'income')).toBe(false);
    });
  });

  describe('filterTransactions', () => {
    it('excludes child transactions and applies filters', () => {
      const list: TransactionEntity[] = [
        {
          id: '1',
          account: 'a1',
          amount: -1000,
          date: '2026-10-01',
          payee: 'p1',
        },
        {
          id: '2',
          account: 'a1',
          amount: 3000,
          date: '2026-10-02',
          payee: 'p1',
        },
        {
          id: '3',
          account: 'a1',
          amount: -500,
          date: '2026-10-03',
          is_child: true,
        },
      ];

      const all = filterTransactions(list, 'all', '', context);
      expect(all.map(t => t.id)).toEqual(['1', '2']);

      const expenses = filterTransactions(list, 'expenses', '', context);
      expect(expenses.map(t => t.id)).toEqual(['1']);

      const income = filterTransactions(list, 'income', '', context);
      expect(income.map(t => t.id)).toEqual(['2']);
    });
  });

  describe('calculateMonthTotals', () => {
    it('calculates spent and received properly', () => {
      const list: TransactionEntity[] = [
        { id: '1', account: 'a1', amount: -1000, date: '2026-10-01' },
        { id: '2', account: 'a1', amount: -2500, date: '2026-10-02' },
        { id: '3', account: 'a1', amount: 5000, date: '2026-10-03' },
        {
          id: '4',
          account: 'a1',
          amount: -999,
          date: '2026-10-04',
          is_child: true,
        },
      ];

      const totals = calculateMonthTotals(list);
      expect(totals.spent).toBe(3500);
      expect(totals.received).toBe(5000);
    });
  });

  describe('groupTransactionsByDay', () => {
    it('groups transactions by day and sorts by date descending', () => {
      const list: TransactionEntity[] = [
        { id: '1', account: 'a1', amount: -1000, date: '2026-10-01' },
        { id: '2', account: 'a1', amount: 2000, date: '2026-10-01' },
        { id: '3', account: 'a1', amount: -500, date: '2026-10-05' },
      ];

      const groups = groupTransactionsByDay(list);
      expect(groups).toHaveLength(2);
      expect(groups[0].date).toBe('2026-10-05');
      expect(groups[0].dayTotal).toBe(-500);
      expect(groups[0].transactions).toHaveLength(1);

      expect(groups[1].date).toBe('2026-10-01');
      expect(groups[1].dayTotal).toBe(1000);
      expect(groups[1].transactions).toHaveLength(2);
    });
  });

  describe('formatDayHeader', () => {
    it('returns Today for current day', () => {
      expect(
        formatDayHeader('2026-10-06', enUS, k => k, '2026-10-06', '2026-10-05'),
      ).toBe('Today');
    });

    it('returns Yesterday for previous day', () => {
      expect(
        formatDayHeader('2026-10-05', enUS, k => k, '2026-10-06', '2026-10-05'),
      ).toBe('Yesterday');
    });

    it('returns localized weekday and date for other days', () => {
      // 2026-09-15 was Tuesday
      const res = formatDayHeader(
        '2026-09-15',
        enUS,
        k => k,
        '2026-10-06',
        '2026-10-05',
      );
      expect(res).toBe('Tuesday 15 September');
    });
  });

  it('leaves transfers between listed accounts out of the month totals', () => {
    const base = { is_child: false } as const;
    const totals = calculateMonthTotals(
      [
        { ...base, id: 'a', amount: -500 } as TransactionEntity,
        { ...base, id: 'b', amount: -1000 } as TransactionEntity,
        { ...base, id: 'c', amount: 1000 } as TransactionEntity,
      ],
      t => t.id !== 'a',
    );
    expect(totals).toEqual({ spent: 500, received: 0 });
  });

  it('titles rows without a payee by their note or category', () => {
    expect(getRowTexts('Albert', 'Food', 'milk', '(No payee)')).toEqual({
      title: 'Albert',
      subtitle: 'Food · milk',
    });
    expect(getRowTexts(null, 'Food', ' lunch ', '(No payee)')).toEqual({
      title: 'lunch',
      subtitle: 'Food',
    });
    expect(getRowTexts(null, 'Food', undefined, '(No payee)')).toEqual({
      title: 'Food',
      subtitle: '',
    });
    expect(getRowTexts(null, '', '', '(No payee)')).toEqual({
      title: '(No payee)',
      subtitle: '',
    });
  });
});
