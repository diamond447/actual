import * as monthUtils from '@actual-app/core/shared/months';
import { getNormalisedString } from '@actual-app/core/shared/normalisation';
import type {
  AccountEntity,
  CategoryEntity,
  PayeeEntity,
  TransactionEntity,
} from '@actual-app/core/types/models';
import type { Locale } from 'date-fns';

export type TransactionFilterType = 'all' | 'expenses' | 'income';

export type DayGroup = {
  date: string;
  dayTotal: number;
  transactions: TransactionEntity[];
};

export type CategoryDisplayInfo = {
  name: string;
  category?: CategoryEntity;
  isSplit: boolean;
  isUncategorized: boolean;
};

export type HelperContext = {
  payeesById?: Record<string, PayeeEntity>;
  categoriesById?: Record<string, CategoryEntity>;
  accountsById?: Record<string, AccountEntity>;
};

/**
 * Resolves the display name for a transaction's payee.
 */
export function getPayeeDisplay(
  transaction: TransactionEntity,
  payeesById: Record<string, PayeeEntity> = {},
  accountsById: Record<string, AccountEntity> = {},
  t: (key: string) => string = k => k,
): string {
  const payeeId = transaction.payee;

  if (payeeId) {
    const payee = payeesById[payeeId];
    if (payee?.transfer_acct) {
      const transferAccount = accountsById[payee.transfer_acct];
      return transferAccount?.name || payee.name;
    }
    if (payee?.name) {
      return payee.name;
    }
    if (payeeId.startsWith('new:')) {
      return payeeId.slice('new:'.length);
    }
  }

  if (transaction.imported_payee) {
    return transaction.imported_payee;
  }

  const isSplit =
    transaction.is_parent ||
    (transaction.subtransactions && transaction.subtransactions.length > 0);

  if (isSplit) {
    const firstSubPayee = transaction.subtransactions?.find(s => s.payee);
    if (firstSubPayee?.payee) {
      const subPayee = payeesById[firstSubPayee.payee];
      if (subPayee?.name) {
        return subPayee.name;
      }
    }
    return t('Split');
  }

  return t('(No payee)');
}

/**
 * Resolves the display category, whether it is a split transaction, and whether it is uncategorized.
 */
export function getCategoryDisplay(
  transaction: TransactionEntity,
  categoriesById: Record<string, CategoryEntity> = {},
  t: (key: string) => string = k => k,
): CategoryDisplayInfo {
  const isSplit =
    transaction.is_parent ||
    (transaction.subtransactions && transaction.subtransactions.length > 0);

  if (isSplit) {
    return {
      name: t('Split'),
      isSplit: true,
      isUncategorized: false,
    };
  }

  const categoryId = transaction.category;
  if (categoryId && categoriesById[categoryId]) {
    const category = categoriesById[categoryId];
    return {
      name: category.name,
      category,
      isSplit: false,
      isUncategorized: false,
    };
  }

  return {
    name: t('Uncategorized'),
    isSplit: false,
    isUncategorized: true,
  };
}

/**
 * Formats the secondary line underneath the payee: "category · note" (or just one of them).
 */
export function formatCategoryAndNotes(
  categoryName: string,
  notes?: string,
): string {
  const cleanNotes = notes?.trim();
  const cleanCategory = categoryName?.trim();

  if (cleanCategory && cleanNotes) {
    return `${cleanCategory} · ${cleanNotes}`;
  }
  if (cleanCategory) {
    return cleanCategory;
  }
  if (cleanNotes) {
    return cleanNotes;
  }
  return '';
}

/**
 * Title and subtitle of a row. Transactions without a payee (e.g. logged
 * with quick add) are titled by their note, or else their category, rather
 * than "(No payee)".
 */
export function getRowTexts(
  payeeName: string | null,
  categoryName: string,
  notes: string | undefined,
  noPayeeLabel: string,
): { title: string; subtitle: string } {
  if (payeeName) {
    return {
      title: payeeName,
      subtitle: formatCategoryAndNotes(categoryName, notes),
    };
  }
  const cleanNotes = notes?.trim();
  if (cleanNotes) {
    return { title: cleanNotes, subtitle: categoryName.trim() };
  }
  if (categoryName.trim()) {
    return { title: categoryName.trim(), subtitle: '' };
  }
  return { title: noPayeeLabel, subtitle: '' };
}

/**
 * Checks whether a transaction matches the given normalized search term.
 */
export function matchesSearch(
  transaction: TransactionEntity,
  searchTerm: string,
  context: HelperContext = {},
): boolean {
  const normalizedSearch = searchTerm.trim()
    ? getNormalisedString(searchTerm.trim())
    : '';

  if (!normalizedSearch) {
    return true;
  }

  const { payeesById = {}, categoriesById = {}, accountsById = {} } = context;

  const payeeName = getPayeeDisplay(transaction, payeesById, accountsById);
  if (getNormalisedString(payeeName).includes(normalizedSearch)) {
    return true;
  }

  const categoryDisplay = getCategoryDisplay(transaction, categoriesById);
  if (getNormalisedString(categoryDisplay.name).includes(normalizedSearch)) {
    return true;
  }

  if (
    transaction.notes &&
    getNormalisedString(transaction.notes).includes(normalizedSearch)
  ) {
    return true;
  }

  // Also check subtransactions (for splits)
  if (transaction.subtransactions && transaction.subtransactions.length > 0) {
    for (const sub of transaction.subtransactions) {
      if (sub.payee) {
        const subPayee = payeesById[sub.payee];
        if (
          subPayee?.name &&
          getNormalisedString(subPayee.name).includes(normalizedSearch)
        ) {
          return true;
        }
      }
      if (sub.category) {
        const subCat = categoriesById[sub.category];
        if (
          subCat?.name &&
          getNormalisedString(subCat.name).includes(normalizedSearch)
        ) {
          return true;
        }
      }
      if (
        sub.notes &&
        getNormalisedString(sub.notes).includes(normalizedSearch)
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Checks whether a transaction matches the filter type (All, Expenses, Income).
 */
export function matchesFilterType(
  transaction: TransactionEntity,
  filterType: TransactionFilterType,
): boolean {
  if (filterType === 'all') {
    return true;
  }
  if (filterType === 'expenses') {
    return transaction.amount < 0;
  }
  if (filterType === 'income') {
    return transaction.amount > 0;
  }
  return true;
}

/**
 * Filters the list of transactions by search term and filter type.
 * Also excludes child transactions of splits.
 */
export function filterTransactions(
  transactions: readonly TransactionEntity[],
  filterType: TransactionFilterType,
  searchTerm: string,
  context: HelperContext = {},
): TransactionEntity[] {
  const normalizedSearch = searchTerm.trim()
    ? getNormalisedString(searchTerm.trim())
    : '';

  return transactions.filter(transaction => {
    // Exclude children of split transactions from top-level list
    if (transaction.is_child) {
      return false;
    }

    if (!matchesFilterType(transaction, filterType)) {
      return false;
    }

    if (
      normalizedSearch &&
      !matchesSearch(transaction, normalizedSearch, context)
    ) {
      return false;
    }

    return true;
  });
}

/**
 * Calculates total spent and received for a filtered list of transactions.
 * Returns amounts in integer cents (spent is a positive number).
 */
export function calculateMonthTotals(
  transactions: readonly TransactionEntity[],
  isTransferBetweenListedAccounts: (t: TransactionEntity) => boolean = () =>
    false,
): { spent: number; received: number } {
  let spent = 0;
  let received = 0;

  for (const t of transactions) {
    if (t.is_child) continue;
    // Both sides of such a transfer are listed; they are neither spending
    // nor income
    if (isTransferBetweenListedAccounts(t)) continue;
    if (t.amount < 0) {
      spent += Math.abs(t.amount);
    } else if (t.amount > 0) {
      received += t.amount;
    }
  }

  return { spent, received };
}

/**
 * Groups transactions by date, preserving date descending order.
 * Calculates net total per day.
 */
export function groupTransactionsByDay(
  transactions: readonly TransactionEntity[],
): DayGroup[] {
  const groupsMap = new Map<string, TransactionEntity[]>();

  for (const t of transactions) {
    if (t.is_child) continue;
    const date = t.date;
    const existing = groupsMap.get(date);
    if (existing) {
      existing.push(t);
    } else {
      groupsMap.set(date, [t]);
    }
  }

  // Sort dates descending
  const sortedDates = Array.from(groupsMap.keys()).sort((a, b) =>
    b.localeCompare(a),
  );

  return sortedDates.map(date => {
    const dayTransactions = groupsMap.get(date) ?? [];
    const dayTotal = dayTransactions.reduce((sum, t) => sum + t.amount, 0);
    return {
      date,
      dayTotal,
      transactions: dayTransactions,
    };
  });
}

/**
 * Formats a day header string: "Today", "Yesterday", or a localized weekday + date like "Monday 15 September".
 */
export function formatDayHeader(
  date: string,
  locale?: Locale,
  t: (key: string) => string = k => k,
  today: string = monthUtils.currentDay(),
  yesterday: string = monthUtils.subDays(today, 1),
): string {
  if (date === today) {
    return t('Today');
  }
  if (date === yesterday) {
    return t('Yesterday');
  }
  return monthUtils.format(date, 'EEEE do MMMM', locale);
}
