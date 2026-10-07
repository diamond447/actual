import { describe, expect, it } from 'vitest';

import type { CleanupCategoryGroup } from './categoryCleanupHelper';
import { getCategoriesToDelete } from './categoryCleanupHelper';

describe('categoryCleanupHelper', () => {
  const sampleGroups: CleanupCategoryGroup[] = [
    {
      id: 'g-usual',
      name: 'Usual Expenses',
      is_income: 0,
      categories: [
        { id: 'c-bills-flex', name: 'Bills (Flexible)', is_income: 0 },
        { id: 'c-food', name: 'Food', is_income: 0 },
        { id: 'c-general', name: 'General', is_income: 0 },
        { id: 'c-bills', name: 'Bills', is_income: 0 },
      ],
    },
    {
      id: 'g-savings',
      name: 'Investments and Savings',
      is_income: 0,
      categories: [{ id: 'c-savings', name: 'Savings', is_income: 0 }],
    },
    {
      id: 'g-income',
      name: 'Income',
      is_income: 1,
      categories: [
        { id: 'c-income', name: 'Income', is_income: 1 },
        { id: 'c-starting', name: 'Starting Balances', is_income: 1 },
      ],
    },
  ];

  it('deletes all default expense categories and expense groups when no transactions exist', () => {
    const deletions = getCategoriesToDelete({
      groups: sampleGroups,
      transactions: [],
    });

    expect(deletions.categoryIds).toEqual([
      'c-bills-flex',
      'c-food',
      'c-general',
      'c-bills',
      'c-savings',
    ]);
    expect(deletions.groupIds).toEqual(['g-usual', 'g-savings']);

    // Never touches income group or income categories
    expect(deletions.categoryIds).not.toContain('c-income');
    expect(deletions.categoryIds).not.toContain('c-starting');
    expect(deletions.groupIds).not.toContain('g-income');
  });

  it('deletes default expense categories when only a starting balance transaction exists', () => {
    const deletions = getCategoriesToDelete({
      groups: sampleGroups,
      transactions: [
        {
          id: 't-start',
          category: 'c-starting',
          starting_balance_flag: true,
        },
      ],
    });

    expect(deletions.categoryIds).toEqual([
      'c-bills-flex',
      'c-food',
      'c-general',
      'c-bills',
      'c-savings',
    ]);
    expect(deletions.groupIds).toEqual(['g-usual', 'g-savings']);
  });

  it('never deletes anything when any non-starting-balance transaction exists', () => {
    const deletions = getCategoriesToDelete({
      groups: sampleGroups,
      transactions: [
        {
          id: 't-regular',
          category: 'c-food',
          starting_balance_flag: false,
        },
      ],
    });

    expect(deletions.categoryIds).toEqual([]);
    expect(deletions.groupIds).toEqual([]);
  });

  it('never touches income groups even if income categories have no transactions', () => {
    const deletions = getCategoriesToDelete({
      groups: sampleGroups,
      transactions: [],
    });

    expect(deletions.groupIds).not.toContain('g-income');
    expect(deletions.categoryIds).not.toContain('c-income');
    expect(deletions.categoryIds).not.toContain('c-starting');
  });

  it('preserves an expense group if any category inside it has transactions', () => {
    const deletions = getCategoriesToDelete({
      groups: sampleGroups,
      transactions: [
        // Suppose a starting balance transaction somehow pointed to c-food
        {
          id: 't-start',
          category: 'c-food',
          starting_balance_flag: true,
        },
      ],
    });

    // c-food has a transaction, so c-food is NOT deleted and g-usual is NOT deleted
    expect(deletions.categoryIds).not.toContain('c-food');
    expect(deletions.groupIds).not.toContain('g-usual');

    // Other categories without transactions are deleted
    expect(deletions.categoryIds).toContain('c-bills');
    expect(deletions.categoryIds).toContain('c-savings');
    expect(deletions.groupIds).toContain('g-savings');
  });
});
