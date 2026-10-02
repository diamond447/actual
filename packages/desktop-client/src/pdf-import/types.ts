/**
 * A piece of text on a statement page. Coordinates are in PDF points with
 * the origin in the top-left corner of the page.
 */
export type StatementTextItem = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** A whole word (from OCR), so it is always separated by a space. */
  isWord?: boolean;
};

export type StatementRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type StatementPage = {
  width: number;
  height: number;
  items: StatementTextItem[];
  /** Areas the user blacked out. Text under them is already removed. */
  redactions: StatementRect[];
  /** The page could not be read at all (e.g. OCR failed). */
  isUnreadable?: boolean;
};

export type ReviewReason =
  | 'missing-amount'
  | 'uncertain-amount'
  | 'missing-description'
  | 'redacted';

export type ParsedStatementTransaction = {
  /** YYYY-MM-DD */
  date: string;
  /** Amount in currency units (not integer cents), null when unreadable */
  amount: number | null;
  payee: string;
  notes: string;
  reviewReasons: ReviewReason[];
};

/**
 * Something on the statement that may hold money but was not read as a
 * transaction. Shown to the user so nothing goes missing silently.
 */
export type UnrecognizedLine = {
  /** 1-based page number */
  page: number;
  /** The line's text, or empty for an unreadable page */
  text: string;
  reason: 'unmatched-line' | 'unreadable-page';
};

export type ParsedStatement = {
  transactions: ParsedStatementTransaction[];
  unrecognizedLines: UnrecognizedLine[];
  /** Balances printed on the statement, used to check the total */
  openingBalance: number | null;
  closingBalance: number | null;
  /**
   * True when the statement has no signs or debit/credit columns, so it is
   * unclear which transactions are expenses.
   */
  hasUncertainSigns: boolean;
};
