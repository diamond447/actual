import { amountToInteger } from '@actual-app/core/shared/util';
import type { ImportTransactionEntity } from '@actual-app/core/types/models';

import type { CategorySource } from './categorize';
import type { ParsedStatementTransaction } from './types';

export type StatementRow = ParsedStatementTransaction & {
  id: string;
  isSelected: boolean;
  /** Typed in by the user, so its sign is final and never flipped */
  isAmountManual?: boolean;
  category?: string | null;
  /** Where the category came from; 'user' when picked by hand */
  categorySource?: CategorySource;
};

export function toStatementRows(
  transactions: ParsedStatementTransaction[],
): StatementRow[] {
  return transactions.map((transaction, index) => ({
    ...transaction,
    id: String(index),
    // Rows without a reliable amount are imported only after a check
    isSelected:
      transaction.amount !== null &&
      !transaction.reviewReasons.includes('uncertain-amount'),
  }));
}

/**
 * A stable id for a statement row. Importing the same statement (or an
 * overlapping one) again matches the transactions instead of duplicating
 * them; the occurrence number keeps identical rows on one day apart.
 */
export function statementImportedId(
  date: string,
  amount: number,
  payee: string,
  occurrence: number,
) {
  const normalizedPayee = payee
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `pdf:${date}:${amount}:${normalizedPayee}:${occurrence}`;
}

/** Selected rows with an amount, ready for the `transactions-import` handler. */
export function toImportTransactions(
  rows: StatementRow[],
  accountId: string,
  { flipSigns = false, decimalPlaces = 2 } = {},
): ImportTransactionEntity[] {
  const occurrences = new Map<string, number>();
  return rows
    .filter(row => row.isSelected && row.amount !== null)
    .map(row => {
      const integerAmount = amountToInteger(row.amount ?? 0, decimalPlaces);
      const amount =
        flipSigns && !row.isAmountManual ? -integerAmount : integerAmount;
      const key = statementImportedId(row.date, amount, row.payee, 0);
      const occurrence = occurrences.get(key) ?? 0;
      occurrences.set(key, occurrence + 1);
      return {
        account: accountId,
        date: row.date,
        amount,
        payee_name: row.payee,
        imported_payee: row.payee,
        imported_id: statementImportedId(
          row.date,
          amount,
          row.payee,
          occurrence,
        ),
        notes: row.notes,
        ...(row.category ? { category: row.category } : {}),
        cleared: true,
      };
    });
}
