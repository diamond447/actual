export type CleanupCategory = {
  id: string;
  name?: string;
  is_income?: boolean | number;
  cat_group?: string;
};

export type CleanupCategoryGroup = {
  id: string;
  name?: string;
  is_income?: boolean | number;
  categories?: CleanupCategory[];
};

export type CleanupTransaction = {
  id?: string;
  category?: string | null;
  starting_balance_flag?: boolean | number | null;
};

export type CategoryDeletions = {
  categoryIds: string[];
  groupIds: string[];
};

/**
 * Decides which categories and groups to delete when setting up onboarding categories.
 *
 * Rules:
 * - Upstream creates a few default categories in every new budget.
 * - When the budget has no transactions at all (or only starting balance transactions),
 *   delete those upstream default categories and groups.
 * - Only expense categories that have no transactions are deleted.
 * - Never delete income groups (that would leave no income category).
 * - Never touch anything if any non-starting-balance transaction exists.
 */
export function getCategoriesToDelete(params: {
  groups: CleanupCategoryGroup[];
  transactions?: CleanupTransaction[];
}): CategoryDeletions {
  const { groups, transactions = [] } = params;

  // Never touch anything if any real user transaction exists
  const hasUserTransactions = transactions.some(t => !t.starting_balance_flag);
  if (hasUserTransactions) {
    return { categoryIds: [], groupIds: [] };
  }

  // Any category with transactions cannot be deleted
  const categoryIdsWithTransactions = new Set(
    transactions
      .map(t => t.category)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  );

  const categoryIds: string[] = [];
  const groupIds: string[] = [];

  for (const group of groups) {
    // Never delete income groups
    if (group.is_income) {
      continue;
    }

    const categories = group.categories ?? [];
    const deleteableCatsInGroup: string[] = [];

    for (const cat of categories) {
      if (!cat.is_income && !categoryIdsWithTransactions.has(cat.id)) {
        deleteableCatsInGroup.push(cat.id);
      }
    }

    // Only delete the group if all its categories are deleted (or it has none)
    if (deleteableCatsInGroup.length === categories.length) {
      categoryIds.push(...deleteableCatsInGroup);
      groupIds.push(group.id);
    } else {
      categoryIds.push(...deleteableCatsInGroup);
    }
  }

  return { categoryIds, groupIds };
}
