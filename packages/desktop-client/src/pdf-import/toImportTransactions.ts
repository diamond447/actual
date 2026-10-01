import { amountToInteger } from '@actual-app/core/shared/util';
import type { ImportTransactionEntity } from '@actual-app/core/types/models';

import type { ParsedStatementTransaction } from './types';

export type StatementRow = ParsedStatementTransaction & {
  id: string;
  isSelected: boolean;
};

export function toStatementRows(
  transactions: ParsedStatementTransaction[],
): StatementRow[] {
  return transactions.map((transaction, index) => ({
    ...transaction,
    id: String(index),
    // Rows without an amount can only be imported after the user fills it in
    isSelected: transaction.amount !== null,
  }));
}

/** Selected rows with an amount, ready for the `transactions-import` handler. */
export function toImportTransactions(
  rows: StatementRow[],
  accountId: string,
  { flipSigns = false, decimalPlaces = 2 } = {},
): ImportTransactionEntity[] {
  return rows
    .filter(row => row.isSelected && row.amount !== null)
    .map(row => {
      const amount = amountToInteger(row.amount ?? 0, decimalPlaces);
      return {
        account: accountId,
        date: row.date,
        amount: flipSigns ? -amount : amount,
        payee_name: row.payee,
        imported_payee: row.payee,
        notes: row.notes,
        cleared: true,
      };
    });
}
