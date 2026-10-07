import * as monthUtils from '@actual-app/core/shared/months';
import type { Locale } from 'date-fns';

export type BudgetType = 'envelope' | 'tracking';

export function isBudgetType(input?: string): input is BudgetType {
  return input === 'envelope' || input === 'tracking';
}

export type HeroBudgetValues = {
  spent: number;
  budgeted: number;
  left: number;
  isOverbudget: boolean;
  progressPercent: number;
  hasBudget: boolean;
};

/**
 * Turns raw spreadsheet values for total spent and total budgeted into
 * display numbers according to budget type (envelope vs tracking).
 *
 * In Actual:
 * - totalSpent in spreadsheet is negative for spending (e.g. -50000 = $500 spent).
 * - totalBudgetedExpense in tracking is positive (e.g. 100000 = $1000 budgeted).
 * - totalBudgeted in envelope is negative (e.g. -100000 = $1000 budgeted).
 */
export function parseHeroBudgetValues(
  rawSpent: number | null | undefined,
  rawBudgeted: number | null | undefined,
  budgetType: BudgetType,
): HeroBudgetValues {
  const spent = rawSpent != null ? Math.max(0, -rawSpent) : 0;

  let budgeted = 0;
  if (rawBudgeted != null) {
    if (budgetType === 'envelope') {
      budgeted = Math.max(0, -rawBudgeted);
    } else {
      budgeted = Math.max(0, rawBudgeted);
    }
  }

  const hasBudget = budgeted > 0;
  const isOverbudget = hasBudget && spent > budgeted;
  const left = !hasBudget
    ? 0
    : isOverbudget
      ? spent - budgeted
      : budgeted - spent;
  const progressPercent = hasBudget
    ? Math.min(100, Math.max(0, (spent / budgeted) * 100))
    : 0;

  return {
    spent,
    budgeted,
    left,
    isOverbudget,
    progressPercent,
    hasBudget,
  };
}

/**
 * Converts raw per-category spent from spreadsheet (negative for expense)
 * into a positive spent amount.
 */
export function parseCategorySpent(
  rawSpent: number | null | undefined,
): number {
  if (rawSpent == null) return 0;
  return Math.max(0, -rawSpent);
}

/**
 * Distributes integer percentages so their sum is strictly 100% using the
 * Largest Remainder Method (Hare-Niemeyer).
 */
export function roundPercentagesTo100<T extends { amount: number }>(
  items: T[],
): Array<T & { percentage: number }> {
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  if (total <= 0 || items.length === 0) {
    return items.map(item => ({ ...item, percentage: 0 }));
  }

  const withFloors = items.map((item, index) => {
    const rawPercent = (item.amount / total) * 100;
    const floor = Math.floor(rawPercent);
    const remainder = rawPercent - floor;
    return {
      item,
      index,
      floor,
      remainder,
    };
  });

  const sumFloors = withFloors.reduce((sum, entry) => sum + entry.floor, 0);
  const deficit = 100 - sumFloors;

  const sortedByRemainder = [...withFloors].sort((a, b) => {
    if (b.remainder !== a.remainder) {
      return b.remainder - a.remainder;
    }
    return b.item.amount - a.item.amount;
  });

  const extraPercentIndices = new Set(
    sortedByRemainder.slice(0, deficit).map(e => e.index),
  );

  return withFloors.map(entry => ({
    ...entry.item,
    percentage: entry.floor + (extraPercentIndices.has(entry.index) ? 1 : 0),
  }));
}

export type CategorySpendingInput = {
  id: string;
  name: string;
  amount: number;
  color: string;
};

export type CategorySpendingDisplayItem = {
  id: string;
  name: string;
  amount: number;
  color: string;
  percentage: number;
  isOther?: boolean;
};

/**
 * Filters out zero-spending categories, sorts descending by spending, takes
 * the top 5, and merges any remaining categories into an "Other" category.
 * Assigns integer percentages that sum to 100%.
 */
export function groupTopCategories(
  categories: CategorySpendingInput[],
  otherLabel = 'Other',
  otherColor = '#9CA3AF',
): CategorySpendingDisplayItem[] {
  const active = categories.filter(cat => cat.amount > 0);
  if (active.length === 0) {
    return [];
  }

  const sorted = [...active].sort((a, b) => b.amount - a.amount);

  let grouped: Array<{
    id: string;
    name: string;
    amount: number;
    color: string;
    isOther?: boolean;
  }>;

  if (sorted.length <= 5) {
    grouped = sorted;
  } else {
    const top5 = sorted.slice(0, 5);
    const rest = sorted.slice(5);
    const otherAmount = rest.reduce((sum, cat) => sum + cat.amount, 0);
    grouped = [
      ...top5,
      {
        id: 'other',
        name: otherLabel,
        amount: otherAmount,
        color: otherColor,
        isOther: true,
      },
    ];
  }

  return roundPercentagesTo100(grouped);
}

/**
 * Calculates days remaining in the month for the current month.
 * Returns null if the specified month is not the current month (past or future).
 */
export function calculateDaysLeft(
  month: string,
  today: string = monthUtils.currentDay(),
): number | null {
  if (month !== monthUtils.getMonth(today)) {
    return null;
  }
  const monthEnd = monthUtils.getMonthEnd(today);
  return Math.max(0, monthUtils.differenceInCalendarDays(monthEnd, today));
}

export type RelativeDateResult =
  | { type: 'today' }
  | { type: 'yesterday' }
  | { type: 'date'; formatted: string };

/**
 * Formats a transaction date relative to today (today, yesterday, or localized date).
 */
export function formatRelativeDate(
  dateStr: string,
  todayStr: string = monthUtils.currentDay(),
  locale?: Locale,
): RelativeDateResult {
  if (dateStr === todayStr) {
    return { type: 'today' };
  }
  if (dateStr === monthUtils.subDays(todayStr, 1)) {
    return { type: 'yesterday' };
  }
  return {
    type: 'date',
    formatted: monthUtils.format(dateStr, 'MMM d', locale),
  };
}
