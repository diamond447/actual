import { amountToInteger } from '@actual-app/core/shared/util';
import type { ImportTransactionEntity } from '@actual-app/core/types/models';

import type { CategorySource } from './categorize';
import type { ParsedStatementTransaction } from './types';

export type StatementRow = ParsedStatementTransaction & {
  id: string;
  isSelected: boolean;
  /** The amount as read from the statement, before any user change */
  parsedAmount: number | null;
  /** Typed in by the user, so its sign is final and never flipped */
  isAmountManual?: boolean;
  /** The user flipped the sign of this row */
  isSignFlipped?: boolean;
  category?: string | null;
  /** Where the category came from; 'user' when picked by hand */
  categorySource?: CategorySource;
  /** Import as a new transaction even if it matches an existing one */
  forceAdd?: boolean;
};

export function toStatementRows(
  transactions: ParsedStatementTransaction[],
): StatementRow[] {
  return transactions.map((transaction, index) => ({
    ...transaction,
    id: String(index),
    parsedAmount: transaction.amount,
    // Rows without a reliable amount are imported only after a check, and
    // rows the user blacked out are not imported unless they ask for it
    isSelected:
      transaction.amount !== null &&
      !transaction.blackedOutRows &&
      !transaction.reviewReasons.includes('uncertain-amount'),
  }));
}

/** The amount of a row as it will be imported, in currency units. */
export function effectiveAmount(row: StatementRow, flipSigns: boolean) {
  if (row.amount === null) {
    return null;
  }
  if (row.isAmountManual) {
    return row.amount;
  }
  return flipSigns !== !!row.isSignFlipped ? -row.amount : row.amount;
}

/**
 * A stable id for a statement row, from what was read on the statement
 * (not from the user's changes). Importing the same statement (or an
 * overlapping one) again matches the transactions instead of duplicating
 * them; the occurrence number keeps identical rows on one day apart.
 */
export function statementImportedId(
  date: string,
  amount: number | null,
  payee: string,
  occurrence: number,
) {
  const normalizedPayee = payee
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `pdf:${date}:${amount ?? 'none'}:${normalizedPayee}:${occurrence}`;
}

/** The handler also accepts this flag, as the CSV import uses it. */
export type PdfImportTransaction = ImportTransactionEntity & {
  forceAddTransaction?: boolean;
};

export type ImportEntry = {
  rowId: string;
  transaction: PdfImportTransaction;
};

/** Selected rows with an amount, ready for the `transactions-import` handler. */
export function toImportEntries(
  rows: StatementRow[],
  accountId: string,
  { flipSigns = false, decimalPlaces = 2 } = {},
): ImportEntry[] {
  const occurrences = new Map<string, number>();
  const entries: ImportEntry[] = [];
  for (const row of rows) {
    const parsedAmount =
      row.parsedAmount === null
        ? null
        : amountToInteger(row.parsedAmount, decimalPlaces);
    const key = `${row.date}|${parsedAmount}|${row.payee}`;
    const occurrence = occurrences.get(key) ?? 0;
    occurrences.set(key, occurrence + 1);

    const amount = effectiveAmount(row, flipSigns);
    if (!row.isSelected || amount === null) {
      continue;
    }
    entries.push({
      rowId: row.id,
      transaction: {
        account: accountId,
        date: row.date,
        amount: amountToInteger(amount, decimalPlaces),
        payee_name: row.payee,
        imported_payee: row.payee,
        imported_id: statementImportedId(
          row.date,
          parsedAmount,
          row.payee,
          occurrence,
        ),
        notes: row.notes,
        ...(row.category ? { category: row.category } : {}),
        ...(row.forceAdd ? { forceAddTransaction: true } : {}),
        cleared: true,
      },
    });
  }
  return entries;
}

export function toImportTransactions(
  rows: StatementRow[],
  accountId: string,
  options: { flipSigns?: boolean; decimalPlaces?: number } = {},
): PdfImportTransaction[] {
  return toImportEntries(rows, accountId, options).map(
    entry => entry.transaction,
  );
}
