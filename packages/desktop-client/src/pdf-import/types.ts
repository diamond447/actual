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

export type ParsedStatement = {
  transactions: ParsedStatementTransaction[];
  /**
   * True when the statement has no signs or debit/credit columns, so it is
   * unclear which transactions are expenses.
   */
  hasUncertainSigns: boolean;
};
