import type {
  ParsedStatement,
  ParsedStatementTransaction,
  ReviewReason,
  StatementPage,
  StatementRect,
  StatementTextItem,
  UnrecognizedLine,
} from './types';

/**
 * Bank-independent parser for the text of a PDF bank statement.
 *
 * The text is grouped into lines and cells by position. A transaction
 * starts on a line whose first cell starts with a date (or on an undated
 * line with an amount, for statements that print the date once per day);
 * its amount is taken from the money column found in the table header, or
 * the first amount on the line without a header.
 *
 * Every amount on the statement is accounted for: it becomes a
 * transaction amount, a balance, or it is reported as an unrecognized
 * line, so no money goes missing silently. Running balances are then used
 * to fill in blacked-out amounts, fix missing signs and flag rows that do
 * not add up.
 */
export function parseStatement(pages: StatementPage[]): ParsedStatement {
  const pending: PendingTransaction[] = [];
  const unrecognizedLines: UnrecognizedLine[] = [];
  let openingBalance: number | null = null;
  let closingBalance: number | null = null;
  let columns: Column[] | null = null;
  // Where dates of transaction rows start, so dates elsewhere are ignored
  let dateX: number | null = null;
  let lastDate: string | null = null;
  let hasSignedAmounts = false;
  let usesDebitCreditColumns = false;
  let isAfterBlackedOutRow = false;

  for (const [pageIndex, page] of pages.entries()) {
    const pageNumber = pageIndex + 1;
    if (page.isUnreadable) {
      unrecognizedLines.push({
        page: pageNumber,
        text: '',
        reason: 'unreadable-page',
      });
    }

    const lines = groupLines(page.items);
    const consumed = new Set<Cell>();
    let current: PendingTransaction | null = null;
    // The transaction table on this page: from its header (or, on pages
    // without a repeated header, its first dated row) to the closing balance
    let tableTop: number | null = null;
    let isTableEnded = false;
    // Bottom of the last thing that belongs to the table on this page
    let tableBottom: number | null = null;
    const pageStart = pending.length;
    const redactedRows = groupRedactionRows(page.redactions);
    const lineHeight = medianLineHeight(lines);
    let redactedRowIndex = 0;

    const start = (transaction: PendingTransaction) => {
      pending.push(transaction);
      lastDate = transaction.date;
      isAfterBlackedOutRow = false;
      return transaction;
    };

    // A table row blacked out as a whole (date, text and amount) has no
    // text left. The user hid it on purpose: it is not imported, but it is
    // listed so the money it moved is still visible in the review.
    const addBlackedOutRowsAbove = (y: number) => {
      while (
        redactedRowIndex < redactedRows.length &&
        redactedRows[redactedRowIndex].y < y
      ) {
        const row = redactedRows[redactedRowIndex++];
        const lastBottom = Math.max(
          tableBottom ?? -Infinity,
          pending.length > pageStart
            ? pending[pending.length - 1].bottom
            : -Infinity,
        );
        // Table rows follow each other closely; a box far below the last
        // row (a footer, a signature) is not part of the table
        const isNextToTable =
          tableTop !== null &&
          !isTableEnded &&
          row.y > tableTop &&
          row.y - lastBottom <= lineHeight * 4;
        if (!isNextToTable) {
          continue;
        }
        const tableColumns = columns;
        const dateColumn = tableColumns?.find(column => column.kind === 'date');
        // A whole row has its date and its amount blacked out in separate
        // boxes; a blacked-out detail line of a visible row only covers the
        // description. A single box across the whole width is ambiguous (it
        // may hide detail lines just as well), and taking it for a hidden row
        // would let it absorb any balance difference, so it is left alone and
        // the balance check flags the next row instead
        const dateRects = row.rects.filter(
          rect =>
            !!dateColumn &&
            !!tableColumns &&
            overlapsColumnArea(rect, dateColumn, tableColumns),
        );
        const moneyRects = row.rects.filter(rect =>
          (tableColumns ?? []).some(
            column =>
              [...moneyKinds, 'balance'].includes(column.kind) &&
              overlapsColumnArea(rect, column, tableColumns ?? []),
          ),
        );
        const isTableRow =
          dateRects.length > 0 &&
          moneyRects.length > 0 &&
          dateRects.some(rect => !moneyRects.includes(rect)) &&
          moneyRects.some(rect => !dateRects.includes(rect)) &&
          // A stray character peeking out of a box does not make it a
          // visible row
          !lines.some(
            line =>
              overlapsRect(line, row) &&
              line.cells
                .map(cell => cell.text)
                .join('')
                .trim().length > 2,
          );
        if (!isTableRow) {
          // e.g. the second line of a blacked-out row's description
          tableBottom = Math.max(lastBottom, row.y + row.height);
          continue;
        }
        const previous = pending[pending.length - 1];
        if (isAfterBlackedOutRow && previous?.blackedOutRows) {
          previous.blackedOutRows++;
          previous.bottom = row.y + row.height;
        } else {
          pending.push({
            date: lastDate ?? '',
            amount: null,
            balance: null,
            hasMoneyCell: true,
            isAmountUncertain: false,
            isRedacted: true,
            blackedOutRows: 1,
            descriptionLines: [],
            bottom: row.y + row.height,
          });
        }
        isAfterBlackedOutRow = true;
        tableBottom = row.y + row.height;
        current = null;
      }
    };

    const takeAmount = (amount: ClassifiedAmount) => {
      consumed.add(amount.cell);
      if (amount.signed) {
        hasSignedAmounts = true;
      }
      if (amount.kind === 'debit' || amount.kind === 'credit') {
        usesDebitCreditColumns = true;
      }
      return amount.value;
    };

    const isLeftAligned = (line: Line) => {
      const first = line.cells[0];
      return (
        !!first &&
        (dateX !== null ? first.x <= dateX + 20 : first.x < page.width * 0.25)
      );
    };

    for (const line of lines) {
      addBlackedOutRowsAbove(line.y);
      const amounts = classifyAmounts(findAmounts(line), columns);
      const date = findLeadingDate(line, dateX);

      if (!date) {
        const header = parseHeader(line);
        if (header) {
          current = null;
          columns = header;
          dateX = header.find(column => column.kind === 'date')?.left ?? dateX;
          tableTop = line.y + line.height;
          tableBottom = tableTop;
          isTableEnded = false;
          continue;
        }
      }

      // Balances and totals: at the left edge without a date, or a dated
      // row that only states a balance ("31.03.2026 Konečný zůstatek")
      const summary =
        isLeftAligned(line) &&
        parseSummary(line, date ? 'balance-only' : 'any');
      if (summary) {
        current = null;
        // A closing balance in a summary above the table ends nothing
        if (summary.closing && tableTop !== null) {
          isTableEnded = true;
        }
        const values = amounts.filter(amount => amount.value !== 0);
        if (summary.opening && values.length > 0) {
          openingBalance ??= values[0].value;
        }
        if (summary.closing && values.length > 0) {
          closingBalance = values[values.length - 1].value;
        }
        amounts.forEach(amount => consumed.add(amount.cell));
        continue;
      }

      if (date) {
        current = null;
        if (tableTop === null && columns) {
          // A continuation page without a repeated header
          tableTop = line.y - 1;
          tableBottom = tableTop;
        }
        const hasMoneyCell = columns
          ? amounts.length > 0 || hasTextInMoneyColumn(line, columns, date)
          : amounts.length > 0;
        if (!columns && amounts.length === 0 && pending.length === 0) {
          // Dates before the transaction table, e.g. the statement period
          continue;
        }
        dateX ??= date.cell.x;
        const money = amounts.find(amount => amount.isMoney);
        const balance = amounts.find(amount => amount.kind === 'balance');
        if (balance) {
          consumed.add(balance.cell);
        }
        amounts
          .filter(amount => amount.value === 0)
          .forEach(amount => consumed.add(amount.cell));
        const isRedacted = overlapsRedaction(line, page.redactions);
        current = start({
          date: date.value,
          amount: money ? takeAmount(money) : null,
          balance: balance?.value ?? null,
          hasMoneyCell,
          // Without a header, a single amount on a row with a blacked-out
          // area may well be the balance
          isAmountUncertain: !columns && isRedacted && amounts.length === 1,
          isRedacted,
          descriptionLines: [
            descriptionOf(
              line,
              [
                ...amounts.map(amount => amount.cell),
                // Unreadable amounts are not part of the description
                ...(columns ? moneyColumnCells(line, columns, date) : []),
              ],
              date,
            ),
          ].filter(Boolean),
          bottom: line.y + line.height,
        });
        continue;
      }

      // An undated line
      if (current && line.y - current.bottom > line.height * 2.5) {
        current = null;
      }
      const isForeignInfo = (amount: ClassifiedAmount) =>
        !!amount.currency && current !== null && current.amount !== null;
      const money = amounts.find(
        amount => amount.isMoney && !isForeignInfo(amount),
      );
      const balance = amounts.find(amount => amount.kind === 'balance');

      if (
        current &&
        current.amount === null &&
        !current.hasMoneyCell &&
        !current.isRedacted
      ) {
        // Some layouts put the amount on the second line of a row
        if (money) {
          current.amount = takeAmount(money);
          current.hasMoneyCell = true;
          if (balance) {
            consumed.add(balance.cell);
            current.balance = balance.value;
          }
          appendDescription(current, line, [money.cell, balance?.cell]);
          current.isRedacted ||= overlapsRedaction(line, page.redactions);
          current.bottom = line.y + line.height;
          continue;
        }
      }

      if ((money || balance) && (current || lastDate)) {
        // Statements that print the date once per day list further
        // transactions without a date. A row whose amount was blacked out
        // never takes the next row's amount: this line is its own row.
        // A row may carry its own date outside the date column
        const ownDate = parseLeadingDate(line.cells[0]?.text ?? '');
        const date: string = ownDate?.value ?? current?.date ?? lastDate ?? '';
        const isRedacted = overlapsRedaction(line, page.redactions);
        if (balance) {
          consumed.add(balance.cell);
        }
        current = start({
          date,
          amount: money ? takeAmount(money) : null,
          balance: balance?.value ?? null,
          hasMoneyCell: true,
          // Without a header any amount could be extra information
          isAmountUncertain: !columns,
          isDateFromPreviousRow: !ownDate,
          isRedacted,
          descriptionLines: [
            descriptionOf(
              line,
              amounts.map(amount => amount.cell),
              ownDate ? { ...ownDate, cell: line.cells[0] } : undefined,
            ),
          ].filter(Boolean),
          bottom: line.y + line.height,
        });
        continue;
      }

      if (current) {
        // Amounts in another currency are extra information of the row
        amounts
          .filter(amount => isForeignInfo(amount) || amount.value === 0)
          .forEach(amount => consumed.add(amount.cell));
        appendDescription(current, line, []);
        current.isRedacted ||= overlapsRedaction(line, page.redactions);
        current.bottom = line.y + line.height;
      }
    }

    addBlackedOutRowsAbove(Infinity);

    // Report every line with an amount that ended up nowhere
    for (const line of lines) {
      const isUnaccounted = findAmounts(line).some(
        amount => amount.value !== 0 && !consumed.has(amount.cell),
      );
      if (isUnaccounted) {
        unrecognizedLines.push({
          page: pageNumber,
          text: line.cells.map(cell => cell.text).join('  '),
          reason: 'unmatched-line',
        });
      }
    }
  }

  // Blacked-out rows before the first dated row take the next row's date
  for (let i = pending.length - 1; i >= 0; i--) {
    if (pending[i].date === '' && i + 1 < pending.length) {
      pending[i].date = pending[i + 1].date;
    }
  }

  const signsKnown = hasSignedAmounts || usesDebitCreditColumns;
  const { signsResolved } = applyRunningBalances(pending, {
    openingBalance,
    fixSigns: !signsKnown,
  });

  const transactions = pending.map(toTransaction);
  return {
    transactions,
    unrecognizedLines,
    openingBalance,
    closingBalance,
    hasUncertainSigns: transactions.length > 0 && !signsKnown && !signsResolved,
  };
}

type Cell = {
  text: string;
  x: number;
  width: number;
};

type Line = {
  y: number;
  height: number;
  cells: Cell[];
};

type ColumnKind =
  | 'amount'
  | 'debit'
  | 'credit'
  | 'balance'
  | 'date'
  /** Foreign amounts, exchange rates, currency: numbers, never the amount */
  | 'foreign'
  /** Description and other text columns */
  | 'other';

type Column = { kind: ColumnKind; left: number; center: number };

type FoundAmount = {
  value: number;
  signed: boolean;
  currency: string | null;
  cell: Cell;
};

type ClassifiedAmount = FoundAmount & {
  /** Nearest header column, or null without a header */
  kind: ColumnKind | null;
  /** Usable as a transaction amount (with the sign of its column) */
  isMoney: boolean;
};

type FoundDate = {
  value: string;
  cell: Cell;
  /** Length of the date text at the start of the cell */
  length: number;
};

type PendingTransaction = {
  date: string;
  amount: number | null;
  /** Running balance printed on the row */
  balance: number | null;
  /** The row has something in a money column, readable or not */
  hasMoneyCell: boolean;
  isAmountUncertain: boolean;
  isRedacted: boolean;
  isAmountFromBalance?: boolean;
  isBalanceMismatch?: boolean;
  /** Unsigned statement where nothing could confirm this row's sign */
  isSignUnchecked?: boolean;
  /** Undated row that took the date of the row above */
  isDateFromPreviousRow?: boolean;
  /** Stands for this many table rows the user blacked out completely */
  blackedOutRows?: number;
  descriptionLines: string[];
  bottom: number;
};

/** Group text items into lines (by vertical position) and cells. */
export function groupLines(items: StatementTextItem[]): Line[] {
  const sorted = items
    .filter(item => item.text.trim() !== '')
    .sort((a, b) => a.y + a.height / 2 - (b.y + b.height / 2));

  const rows: StatementTextItem[][] = [];
  for (const item of sorted) {
    const row = rows[rows.length - 1];
    if (row) {
      const rowCenter = row[0].y + row[0].height / 2;
      const tolerance = Math.max(2, Math.min(row[0].height, item.height) / 2);
      if (Math.abs(item.y + item.height / 2 - rowCenter) <= tolerance) {
        row.push(item);
        continue;
      }
    }
    rows.push([item]);
  }

  return rows.map(row => {
    row.sort((a, b) => a.x - b.x);
    // The median ignores OCR noise like a tall "|" from a table border
    const heights = row.map(item => item.height).sort((a, b) => a - b);
    const height = heights[Math.floor(heights.length / 2)];
    const cells: Cell[] = [];
    for (const item of row) {
      const cell = cells[cells.length - 1];
      const gap = cell ? item.x - (cell.x + cell.width) : Infinity;
      if (cell && gap < height * 0.9) {
        const needsSpace = item.isWord || gap > height * 0.12;
        const separator = needsSpace && !cell.text.endsWith(' ') ? ' ' : '';
        cell.text += separator + item.text;
        cell.width = item.x + item.width - cell.x;
      } else {
        cells.push({ text: item.text, x: item.x, width: item.width });
      }
    }
    for (const cell of cells) {
      cell.text = cell.text.replace(/\s+/g, ' ').trim();
    }
    return {
      y: Math.min(...row.map(item => item.y)),
      height,
      cells,
    };
  });
}

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Header labels, most specific first. */
const headerKinds: Array<{ kind: ColumnKind; pattern: RegExp }> = [
  // Amounts in another currency or exchange rates are never the amount
  {
    kind: 'foreign',
    pattern: /puvodni|original|\bmen[ay]\b|currency|kurz|\brate\b/,
  },
  { kind: 'balance', pattern: /zustatek|balance|saldo|\bstav\b/ },
  {
    kind: 'debit',
    pattern:
      /\bdebet\b|\bvydaje?\b|\bvydej\b|\bodchozi\b|withdrawals?|\bdebit\b|ma dati/,
  },
  {
    kind: 'credit',
    pattern:
      /\bkredit\b|\bprijem\b|\bprijmy\b|\bprichozi\b|deposits?|\bcredit\b|^dal$/,
  },
  { kind: 'amount', pattern: /castka|amount|\bobrat\b|\bsuma\b/ },
  { kind: 'date', pattern: /datum|\bdate\b/ },
  {
    kind: 'other',
    pattern:
      /popis|description|detail|nazev|protistrana|prijemce|zprava|\btyp\b|operace|transakce|ucet|variabilni|\b[vks]s\b|poznamka/,
  },
];

const moneyKinds: ColumnKind[] = ['amount', 'debit', 'credit'];

/**
 * A table header: labels only, with a date column and a money column.
 * Requiring the date column keeps description lines like
 * "Odchozí úhrada | VS: 123" from being taken for a header.
 */
function parseHeader(line: Line): Column[] | null {
  if (
    line.cells.some(
      cell => parseLeadingDate(cell.text) || parseAmount(cell.text),
    )
  ) {
    return null;
  }

  const columns: Column[] = [];
  for (const cell of line.cells) {
    const text = normalize(cell.text);
    const match = headerKinds.find(({ pattern }) => pattern.test(text));
    if (match) {
      columns.push({
        kind: match.kind,
        left: cell.x,
        center: cell.x + cell.width / 2,
      });
    }
  }

  const hasDateColumn = columns.some(column => column.kind === 'date');
  const hasMoneyColumn = columns.some(column =>
    moneyKinds.includes(column.kind),
  );
  return hasDateColumn && hasMoneyColumn ? columns : null;
}

const openingPattern =
  /^(pocatecni (zustatek|stav)|zustatek na zacatku|predchozi zustatek|opening balance|previous balance|starting balance|beginning balance)/;
const closingPattern =
  /^(konecny (zustatek|stav)|zustatek na konci|novy zustatek|closing balance|ending balance|new balance)/;
const otherSummaryPattern =
  /^(celkem|soucet|souhrn|obraty|zustatek|disponibilni zustatek|blokovane|stav uctu|total|balance|strana|page)\b/;

/**
 * Balances and totals. In 'balance-only' mode (dated rows) only phrases
 * about a balance count, so a payee like "TOTAL BENZINA" stays a payment.
 */
function parseSummary(
  line: Line,
  mode: 'any' | 'balance-only',
): { opening: boolean; closing: boolean } | null {
  const texts = line.cells.map(cell => normalize(cell.text));
  const opening = texts.some(text => openingPattern.test(text));
  const closing = texts.some(text => closingPattern.test(text));
  if (opening || closing) {
    return { opening, closing };
  }
  if (mode === 'any' && otherSummaryPattern.test(texts[0] ?? '')) {
    return { opening: false, closing: false };
  }
  if (
    mode === 'balance-only' &&
    texts.some(text => /^(zustatek|balance)\b/.test(text))
  ) {
    return { opening: false, closing: false };
  }
  return null;
}

const datePatterns: Array<{
  pattern: RegExp;
  toParts: (match: RegExpMatchArray) => [string, string, string];
}> = [
  {
    pattern: /^(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4}|\d{2})(?![\d.,])/,
    toParts: match => [match[3], match[2], match[1]],
  },
  {
    pattern: /^(\d{4})-(\d{2})-(\d{2})(?!\d)/,
    toParts: match => [match[1], match[2], match[3]],
  },
  {
    // European day/month/year
    pattern: /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?!\d)/,
    toParts: match => [match[3], match[2], match[1]],
  },
];

/** Parse a date at the start of the text, e.g. "05.03.2026 PLATBA". */
function parseLeadingDate(
  text: string,
): { value: string; length: number } | null {
  for (const { pattern, toParts } of datePatterns) {
    const match = text.match(pattern);
    if (!match) {
      continue;
    }
    const [rawYear, rawMonth, rawDay] = toParts(match);
    const year = Number(rawYear.length === 2 ? `20${rawYear}` : rawYear);
    const month = Number(rawMonth);
    const day = Number(rawDay);
    const date = new Date(Date.UTC(year, month - 1, day));
    const isValid =
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day;
    if (!isValid) {
      continue;
    }
    return {
      value: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      length: match[0].length,
    };
  }
  return null;
}

/** Parse text that is exactly a date. */
export function parseDate(text: string): string | null {
  const trimmed = text.trim();
  const date = parseLeadingDate(trimmed);
  return date && date.length === trimmed.length ? date.value : null;
}

/**
 * The date that starts a transaction row: at the start of the first cell
 * (or the second, after a short row number), in the date column.
 */
function findLeadingDate(line: Line, dateX: number | null): FoundDate | null {
  const [first, second] = line.cells;
  const candidates =
    first && /^\d{1,4}\.?$/.test(first.text) && second
      ? [second]
      : first
        ? [first]
        : [];
  for (const cell of candidates) {
    if (dateX !== null && Math.abs(cell.x - dateX) > 30) {
      continue;
    }
    const date = parseLeadingDate(cell.text);
    if (date) {
      return { ...date, cell };
    }
  }
  return null;
}

const currencyPattern = 'CZK|Kč|EUR|€|USD|\\$|GBP|£|PLN|zł|CHF|HUF|Ft';
const amountPattern = new RegExp(
  `^([+\\-\\u2212]?)\\s?(${currencyPattern})?\\s?(\\d{1,3}(?:[ \\u00a0\\u202f.,'’]\\d{3})*|\\d+)[.,](\\d{2})\\s?(${currencyPattern})?\\s?(-?)$`,
  'i',
);

export function parseAmount(
  text: string,
): { value: number; signed: boolean; currency: string | null } | null {
  const match = text.trim().match(amountPattern);
  if (!match) {
    return null;
  }
  const [, leadingSign, prefixCurrency, integerPart, fraction, suffixCurrency] =
    match;
  const trailingMinus = match[6];
  const value = Number(`${integerPart.replace(/\D/g, '')}.${fraction}`);
  const isNegative = leadingSign === '-' || leadingSign === '−';
  return {
    value: isNegative || trailingMinus ? -value : value,
    signed: leadingSign !== '' || trailingMinus !== '',
    currency: prefixCurrency ?? suffixCurrency ?? null,
  };
}

function findAmounts(line: Line): FoundAmount[] {
  const amounts: FoundAmount[] = [];
  for (const cell of line.cells) {
    const amount = parseAmount(cell.text);
    if (amount) {
      amounts.push({ ...amount, cell });
    }
  }
  return amounts;
}

/**
 * The column a cell belongs to. Statements right-align numbers, while
 * headers may sit left, right or centered above them, so the cell's right
 * edge falls inside its column's area (from its header to the next
 * header). A little slack covers numbers that end just past the next
 * header's left edge.
 */
function nearestColumn(cell: Cell, columns: Column[]): Column {
  const sorted = [...columns].sort((a, b) => a.left - b.left);
  const right = cell.x + cell.width - Math.min(6, cell.width / 4);
  let match = sorted[0];
  for (const column of sorted) {
    if (column.left <= right) {
      match = column;
    }
  }
  if (match.kind !== 'other') {
    return match;
  }
  // A number that seems to sit in a text column (e.g. centered under a
  // right-aligned money header) belongs to the nearest money header right
  // above it. Numbers further away, such as "Kurz 25,10" in a description,
  // stay where they are; exchange rate or foreign amount columns are never
  // overridden
  const center = cell.x + cell.width / 2;
  const nearby = sorted
    .filter(
      column =>
        [...moneyKinds, 'balance'].includes(column.kind) &&
        Math.abs(center - column.center) <=
          (column.center - column.left + cell.width / 2) * 1.5,
    )
    .sort(
      (a, b) => Math.abs(center - a.center) - Math.abs(center - b.center),
    )[0];
  return nearby ?? match;
}

/** Whether a blacked-out area reaches into a column's area. */
function overlapsColumnArea(
  rect: StatementRect,
  column: Column,
  columns: Column[],
) {
  const next = columns
    .filter(other => other.left > column.left)
    .reduce((min, other) => Math.min(min, other.left), Infinity);
  return rect.x < next && rect.x + rect.width > column.left;
}

/**
 * Assign amounts to their header columns. Money columns give the sign
 * (debit is negative); zeros only fill unused debit/credit columns.
 * Without a header, the first amount is the transaction amount and a
 * later one is usually the running balance.
 */
function classifyAmounts(
  amounts: FoundAmount[],
  columns: Column[] | null,
): ClassifiedAmount[] {
  if (!columns) {
    return amounts.map((amount, index) => ({
      ...amount,
      kind: null,
      isMoney: index === 0 && amount.value !== 0,
    }));
  }
  return amounts.map(amount => {
    const { kind } = nearestColumn(amount.cell, columns);
    const magnitude = Math.abs(amount.value);
    if (kind === 'debit' || kind === 'credit') {
      return {
        ...amount,
        kind,
        value: kind === 'debit' ? -magnitude : magnitude,
        signed: true,
        isMoney: magnitude !== 0,
      };
    }
    return { ...amount, kind, isMoney: kind === 'amount' && magnitude !== 0 };
  });
}

/** Cells with numbers (even unreadable) in a money or balance column. */
function moneyColumnCells(line: Line, columns: Column[], date: FoundDate) {
  return line.cells.filter(
    cell =>
      cell !== date.cell &&
      [...moneyKinds, 'balance'].includes(nearestColumn(cell, columns).kind) &&
      /\d/.test(cell.text),
  );
}

function hasTextInMoneyColumn(line: Line, columns: Column[], date: FoundDate) {
  return moneyColumnCells(line, columns, date).length > 0;
}

/** Text of a line without its date and the given amount cells. */
function descriptionOf(
  line: Line,
  amountCells: Array<Cell | undefined>,
  date?: FoundDate,
) {
  return line.cells
    .filter(cell => !amountCells.includes(cell))
    .map(cell =>
      cell === date?.cell ? cell.text.slice(date.length).trim() : cell.text,
    )
    .filter(text => text !== '' && !parseDate(text))
    .join(' ')
    .trim();
}

function appendDescription(
  transaction: PendingTransaction,
  line: Line,
  amountCells: Array<Cell | undefined>,
) {
  const text = descriptionOf(line, amountCells);
  if (text) {
    transaction.descriptionLines.push(text);
  }
}

function overlapsRedaction(line: Line, redactions: StatementRect[]) {
  return redactions.some(
    rect =>
      rect.y < line.y + line.height + 1 && rect.y + rect.height > line.y - 1,
  );
}

function medianLineHeight(lines: Line[]) {
  const heights = lines.map(line => line.height).sort((a, b) => a - b);
  return heights.length > 0 ? heights[Math.floor(heights.length / 2)] : 8;
}

type RedactionRow = { y: number; height: number; rects: StatementRect[] };

/** Group blacked-out areas that sit on the same text line, top to bottom. */
function groupRedactionRows(redactions: StatementRect[]): RedactionRow[] {
  const rows: RedactionRow[] = [];
  for (const rect of [...redactions].sort((a, b) => a.y - b.y)) {
    const row = rows.find(
      candidate => Math.abs(candidate.y - rect.y) < rect.height / 2,
    );
    if (row) {
      row.rects.push(rect);
      row.height = Math.max(row.height, rect.y + rect.height - row.y);
    } else {
      rows.push({ y: rect.y, height: rect.height, rects: [rect] });
    }
  }
  return rows;
}

function overlapsRect(line: Line, rect: { y: number; height: number }) {
  return rect.y < line.y + line.height && rect.y + rect.height > line.y;
}

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Use the running balance printed on the rows: the change between two
 * rows is the amount of the second. That fills in blacked-out amounts,
 * gives unsigned statements their signs and flags rows that do not add up.
 * Statements listed newest first are detected and read in reverse.
 */
function applyRunningBalances(
  transactions: PendingTransaction[],
  {
    openingBalance,
    fixSigns,
  }: { openingBalance: number | null; fixSigns: boolean },
): { signsResolved: boolean } {
  const withBalance = transactions.filter(t => t.balance !== null);
  if (withBalance.length < 2 && openingBalance === null) {
    return { signsResolved: false };
  }

  const countMatches = (ordered: PendingTransaction[]) => {
    let matches = 0;
    for (let i = 1; i < ordered.length; i++) {
      const [previous, row] = [ordered[i - 1], ordered[i]];
      if (
        previous.balance === null ||
        row.balance === null ||
        row.amount === null
      ) {
        continue;
      }
      const change = round(row.balance - previous.balance);
      if (
        fixSigns
          ? Math.abs(change) === Math.abs(row.amount)
          : change === row.amount
      ) {
        matches++;
      }
    }
    return matches;
  };
  const reversed = [...transactions].reverse();
  const ordered =
    countMatches(reversed) > countMatches(transactions)
      ? reversed
      : transactions;

  let previousBalance = ordered === transactions ? openingBalance : null;
  let unresolvedSigns = 0;
  // Blacked-out rows since the last known balance; whatever they moved is
  // the part of the next balance change the next row does not explain
  let blackedOut: PendingTransaction | null = null;
  for (const row of ordered) {
    if (row.blackedOutRows) {
      blackedOut = previousBalance === null ? null : row;
      continue;
    }
    if (blackedOut) {
      const gap = blackedOut;
      blackedOut = null;
      if (
        row.balance !== null &&
        previousBalance !== null &&
        row.amount !== null &&
        !fixSigns
      ) {
        gap.amount = round(row.balance - previousBalance - row.amount);
        gap.isAmountFromBalance = true;
      } else if (fixSigns) {
        // Without signs on the statement, the gap hides whether this row
        // is an expense or income
        row.isSignUnchecked = true;
        unresolvedSigns++;
      }
      // The gap explains any difference, so this row is not checked
      previousBalance =
        row.balance ??
        (gap.amount !== null && previousBalance !== null && row.amount !== null
          ? round(previousBalance + gap.amount + row.amount)
          : null);
      continue;
    }
    if (row.balance !== null && previousBalance !== null) {
      const change = round(row.balance - previousBalance);
      if (row.amount === null) {
        if (!row.isAmountUncertain) {
          row.amount = change;
          row.isAmountFromBalance = true;
        }
      } else if (fixSigns && Math.abs(row.amount) === Math.abs(change)) {
        row.amount = change;
      } else if (row.amount !== change) {
        row.isBalanceMismatch = true;
        if (fixSigns) unresolvedSigns++;
      }
    } else if (fixSigns) {
      unresolvedSigns++;
    }
    previousBalance =
      row.balance ??
      (previousBalance !== null && row.amount !== null
        ? round(previousBalance + row.amount)
        : null);
  }
  return { signsResolved: fixSigns && unresolvedSigns === 0 };
}

const transactionTypePattern =
  /^(platba kartou|platba|odchozi( okamzita)? platba|prichozi( okamzita)? platba|odchozi uhrada|prichozi uhrada|trvaly prikaz|inkaso|sipo|vyber (z bankomatu|hotovosti)|vklad|poplatek|uroky?|card payment|payment|transfer|direct debit|standing order|atm withdrawal|incoming payment|outgoing payment)\b/;

const referencePattern =
  /^((vs|ks|ss)[:\s]|variabilni|konstantni|specificky|cislo karty|\*{2,}|x{4,}|\d[\d\s/-]{5,}$)/;

function toTransaction(
  pending: PendingTransaction,
): ParsedStatementTransaction {
  const lines = pending.descriptionLines;
  const payee =
    lines.find(line => {
      const text = normalize(line);
      return !transactionTypePattern.test(text) && !referencePattern.test(text);
    }) ??
    lines[0] ??
    '';

  if (pending.blackedOutRows) {
    return {
      date: pending.date,
      amount: pending.amount,
      payee: '',
      notes: '',
      reviewReasons: ['blacked-out-rows'],
      blackedOutRows: pending.blackedOutRows,
    };
  }

  const reviewReasons: ReviewReason[] = [];
  if (pending.amount === null) {
    reviewReasons.push('missing-amount');
  } else if (pending.isAmountFromBalance) {
    reviewReasons.push('amount-from-balance');
  } else if (pending.isAmountUncertain) {
    reviewReasons.push('uncertain-amount');
  }
  if (pending.isBalanceMismatch) {
    reviewReasons.push('balance-mismatch');
  }
  if (pending.isSignUnchecked) {
    reviewReasons.push('unchecked-sign');
  }
  if (pending.isDateFromPreviousRow) {
    reviewReasons.push('date-from-previous-row');
  }
  if (lines.length === 0) {
    reviewReasons.push('missing-description');
  }
  if (pending.isRedacted) {
    reviewReasons.push('redacted');
  }

  return {
    date: pending.date,
    amount: pending.amount,
    payee,
    notes: lines.join(' · '),
    reviewReasons,
  };
}
