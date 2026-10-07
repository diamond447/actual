import { describe, expect, it } from 'vitest';

import {
  calculateDaysLeft,
  formatRelativeDate,
  groupTopCategories,
  parseCategorySpent,
  parseHeroBudgetValues,
  roundPercentagesTo100,
} from './overviewCalculations';

describe('overviewCalculations', () => {
  describe('parseHeroBudgetValues', () => {
    it('handles tracking budget correctly with under-budget spending', () => {
      const result = parseHeroBudgetValues(-45000, 100000, 'tracking');
      expect(result).toEqual({
        spent: 45000,
        budgeted: 100000,
        left: 55000,
        isOverbudget: false,
        progressPercent: 45,
        hasBudget: true,
      });
    });

    it('handles tracking budget when overspent', () => {
      const result = parseHeroBudgetValues(-120000, 100000, 'tracking');
      expect(result).toEqual({
        spent: 120000,
        budgeted: 100000,
        left: 20000,
        isOverbudget: true,
        progressPercent: 100,
        hasBudget: true,
      });
    });

    it('handles envelope budget with negative budgeted sign', () => {
      // In envelope budget, both spent and budgeted are stored as negative numbers
      const result = parseHeroBudgetValues(-60000, -80000, 'envelope');
      expect(result).toEqual({
        spent: 60000,
        budgeted: 80000,
        left: 20000,
        isOverbudget: false,
        progressPercent: 75,
        hasBudget: true,
      });
    });

    it('handles envelope budget when overspent', () => {
      const result = parseHeroBudgetValues(-90000, -80000, 'envelope');
      expect(result).toEqual({
        spent: 90000,
        budgeted: 80000,
        left: 10000,
        isOverbudget: true,
        progressPercent: 100,
        hasBudget: true,
      });
    });

    it('handles unbudgeted state (zero or null budgeted)', () => {
      const resultTracking = parseHeroBudgetValues(-30000, 0, 'tracking');
      expect(resultTracking).toEqual({
        spent: 30000,
        budgeted: 0,
        left: 0,
        isOverbudget: false,
        progressPercent: 0,
        hasBudget: false,
      });

      const resultNull = parseHeroBudgetValues(-30000, null, 'envelope');
      expect(resultNull).toEqual({
        spent: 30000,
        budgeted: 0,
        left: 0,
        isOverbudget: false,
        progressPercent: 0,
        hasBudget: false,
      });
    });

    it('handles null/undefined spent', () => {
      const result = parseHeroBudgetValues(null, 50000, 'tracking');
      expect(result).toEqual({
        spent: 0,
        budgeted: 50000,
        left: 50000,
        isOverbudget: false,
        progressPercent: 0,
        hasBudget: true,
      });
    });
  });

  describe('parseCategorySpent', () => {
    it('turns negative raw spent into positive amount', () => {
      expect(parseCategorySpent(-1250)).toBe(1250);
    });

    it('returns 0 for 0, positive amounts, or null/undefined', () => {
      expect(parseCategorySpent(0)).toBe(0);
      expect(parseCategorySpent(500)).toBe(0);
      expect(parseCategorySpent(null)).toBe(0);
      expect(parseCategorySpent(undefined)).toBe(0);
    });
  });

  describe('roundPercentagesTo100', () => {
    it('distributes percentages so the sum is strictly 100%', () => {
      const items = [
        { id: '1', amount: 100 },
        { id: '2', amount: 100 },
        { id: '3', amount: 100 },
      ];
      const result = roundPercentagesTo100(items);
      const sum = result.reduce((acc, curr) => acc + curr.percentage, 0);
      expect(sum).toBe(100);
      expect(result.map(r => r.percentage)).toEqual([34, 33, 33]);
    });

    it('handles exact splits', () => {
      const items = [
        { id: '1', amount: 75 },
        { id: '2', amount: 25 },
      ];
      const result = roundPercentagesTo100(items);
      expect(result.map(r => r.percentage)).toEqual([75, 25]);
    });

    it('handles 7 items with odd remainders', () => {
      const items = Array.from({ length: 7 }, (_, i) => ({
        id: String(i),
        amount: 10,
      }));
      const result = roundPercentagesTo100(items);
      const sum = result.reduce((acc, curr) => acc + curr.percentage, 0);
      expect(sum).toBe(100);
    });

    it('handles empty or zero total items', () => {
      expect(roundPercentagesTo100([])).toEqual([]);
      expect(roundPercentagesTo100([{ id: '1', amount: 0 }])).toEqual([
        { id: '1', amount: 0, percentage: 0 },
      ]);
    });
  });

  describe('groupTopCategories', () => {
    it('returns empty array when no categories have spending', () => {
      expect(
        groupTopCategories([
          { id: '1', name: 'Food', amount: 0, color: '#f00' },
        ]),
      ).toEqual([]);
    });

    it('keeps up to 5 categories without adding Other', () => {
      const categories = [
        { id: '1', name: 'Groceries', amount: 5000, color: '#111' },
        { id: '2', name: 'Dining', amount: 3000, color: '#222' },
        { id: '3', name: 'Gas', amount: 2000, color: '#333' },
      ];
      const result = groupTopCategories(categories);
      expect(result).toHaveLength(3);
      expect(result.some(r => r.isOther)).toBe(false);
      const sum = result.reduce((acc, r) => acc + r.percentage, 0);
      expect(sum).toBe(100);
    });

    it('merges 6th and subsequent categories into Other', () => {
      const categories = [
        { id: '1', name: 'Cat 1', amount: 6000, color: '#1' },
        { id: '2', name: 'Cat 2', amount: 5000, color: '#2' },
        { id: '3', name: 'Cat 3', amount: 4000, color: '#3' },
        { id: '4', name: 'Cat 4', amount: 3000, color: '#4' },
        { id: '5', name: 'Cat 5', amount: 2000, color: '#5' },
        { id: '6', name: 'Cat 6', amount: 1000, color: '#6' },
        { id: '7', name: 'Cat 7', amount: 500, color: '#7' },
      ];
      const result = groupTopCategories(categories, 'Other', '#999');
      expect(result).toHaveLength(6);
      expect(result.slice(0, 5).map(r => r.name)).toEqual([
        'Cat 1',
        'Cat 2',
        'Cat 3',
        'Cat 4',
        'Cat 5',
      ]);
      const other = result[5];
      expect(other.name).toBe('Other');
      expect(other.amount).toBe(1500);
      expect(other.color).toBe('#999');
      expect(other.isOther).toBe(true);

      const sum = result.reduce((acc, r) => acc + r.percentage, 0);
      expect(sum).toBe(100);
    });
  });

  describe('calculateDaysLeft', () => {
    it('calculates remaining days for current month', () => {
      // 2026-10 has 31 days. On 2026-10-06, there are 25 days left
      expect(calculateDaysLeft('2026-10', '2026-10-06')).toBe(25);
    });

    it('returns 0 on the last day of the month', () => {
      expect(calculateDaysLeft('2026-10', '2026-10-31')).toBe(0);
    });

    it('returns null for past or future months', () => {
      expect(calculateDaysLeft('2026-09', '2026-10-06')).toBeNull();
      expect(calculateDaysLeft('2026-11', '2026-10-06')).toBeNull();
    });
  });

  describe('formatRelativeDate', () => {
    it('returns today for current date', () => {
      expect(formatRelativeDate('2026-10-06', '2026-10-06')).toEqual({
        type: 'today',
      });
    });

    it('returns yesterday for day before', () => {
      expect(formatRelativeDate('2026-10-05', '2026-10-06')).toEqual({
        type: 'yesterday',
      });
    });

    it('returns formatted date for earlier dates', () => {
      const result = formatRelativeDate('2026-09-20', '2026-10-06');
      expect(result.type).toBe('date');
      if (result.type === 'date') {
        expect(result.formatted).toBe('Sep 20');
      }
    });
  });
});
