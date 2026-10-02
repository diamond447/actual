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
 * starts on a line whose first cell starts with a date; its amount is taken
 * from the money column found in the table header (or, without a header,
 * the first amount on the line), and lines below it without a date are
 * added to its description.
 */
export function parseStatement(pages: StatementPage[]): ParsedStatement {
  const transactions: ParsedStatementTransaction[] = [];
  const unrecognizedLines: UnrecognizedLine[] = [];
  let openingBalance: number | null = null;
  let closingBalance: number | null = null;
  let columns: Column[] | null = null;
  // Where dates of transaction rows start, so dates elsewhere are ignored
  let dateX: number | null = null;
  let hasSignedAmounts = false;
  let usesDebitCreditColumns = false;

  for (const [pageIndex, page] of pages.entries()) {
    if (page.isUnreadable) {
      unrecognizedLines.push({
        page: pageIndex + 1,
        text: '',
        reason: 'unreadable-page',
      });
    }
    const lines = groupLines(page.items);
    let current: PendingTransaction | null = null;

    const finish = () => {
      if (current) {
        transactions.push(toTransaction(current));
        current = null;
      }
    };

    const takeAmount = (amount: PickedAmount | null) => {
      if (amount?.signed) {
        hasSignedAmounts = true;
      }
      if (amount?.fromDebitCreditColumn) {
        usesDebitCreditColumns = true;
      }
      return amount?.value ?? null;
    };

    for (const line of lines) {
      const header = parseHeader(line);
      if (header) {
        finish();
        columns = header;
        const dateColumn = header.find(column => column.kind === 'date');
        dateX = dateColumn ? dateColumn.left : dateX;
        continue;
      }

      const summary = parseSummaryLine(line);
      if (summary) {
        finish();
        if (summary.kind === 'opening') {
          openingBalance ??= summary.amount;
        } else if (summary.kind === 'closing') {
          closingBalance = summary.amount ?? closingBalance;
        }
        continue;
      }

      const date = findLeadingDate(line, dateX);
      if (date) {
        const amounts = findAmounts(line, date.cell);
        if (amounts.length === 0 && !columns) {
          // Dates outside of a transaction table, e.g. the statement period
          finish();
          continue;
        }

        finish();
        dateX ??= date.cell.x;
        const picked = pickAmount(amounts, columns);
        const isRedacted = overlapsRedaction(line, page.redactions);
        current = {
          date: date.value,
          amount: takeAmount(picked),
          // Without a header, a single amount on a row with a blacked-out
          // area may well be the balance
          isAmountUncertain: !columns && isRedacted && amounts.length === 1,
          isRedacted,
          descriptionLines: [
            descriptionOf(
              line,
              amounts.map(amount => amount.cell),
              date,
            ),
          ].filter(Boolean),
          bottom: line.y + line.height,
        };
        continue;
      }

      const lineAmounts = findAmounts(line);
      const startsWithDate =
        !!line.cells[0] && !!parseLeadingDate(line.cells[0].text);
      const picked = columns ? pickAmount(lineAmounts, columns) : null;

      if (
        current &&
        (line.y - current.bottom > line.height * 2.5 ||
          // A dated row outside the date column is reported, not merged
          (startsWithDate && lineAmounts.length > 0))
      ) {
        finish();
      }

      if (
        current &&
        picked &&
        (current.amount !== null || current.isRedacted)
      ) {
        // Statements that print the date once per day list further
        // transactions of that day without a date. A row whose amount was
        // blacked out never takes the next row's amount.
        const sameDay: string = current.date;
        finish();
        current = {
          date: sameDay,
          amount: takeAmount(picked),
          isAmountUncertain: false,
          isRedacted: overlapsRedaction(line, page.redactions),
          descriptionLines: [
            descriptionOf(
              line,
              lineAmounts.map(amount => amount.cell),
            ),
          ].filter(Boolean),
          bottom: line.y + line.height,
        };
        continue;
      }

      if (current) {
        // Some layouts put the amount on the second line of a row
        let amountCells: Cell[] = [];
        if (current.amount === null && picked) {
          current.amount = takeAmount(picked);
          amountCells = lineAmounts.map(amount => amount.cell);
        }
        const text = descriptionOf(line, amountCells);
        if (text) {
          current.descriptionLines.push(text);
        }
        current.isRedacted ||= overlapsRedaction(line, page.redactions);
        current.bottom = line.y + line.height;
        continue;
      }

      // Anything else with an amount (or a date in the table) might be a
      // transaction we could not read
      const hasAmount = lineAmounts.some(amount => amount.value !== 0);
      if (
        (hasAmount || (columns && startsWithDate)) &&
        !mentionsBalance(line)
      ) {
        unrecognizedLines.push({
          page: pageIndex + 1,
          text: line.cells.map(cell => cell.text).join('  '),
          reason: 'unmatched-line',
        });
      }
    }

    finish();
  }

  return {
    transactions,
    unrecognizedLines,
    openingBalance,
    closingBalance,
    hasUncertainSigns:
      transactions.length > 0 && !hasSignedAmounts && !usesDebitCreditColumns,
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

type ColumnKind = 'amount' | 'debit' | 'credit' | 'balance' | 'date' | 'other';

type Column = { kind: ColumnKind; left: number; center: number };

type FoundAmount = {
  value: number;
  signed: boolean;
  cell: Cell;
};

type PickedAmount = {
  value: number;
  signed: boolean;
  fromDebitCreditColumn: boolean;
  cell: Cell;
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
  isAmountUncertain: boolean;
  isRedacted: boolean;
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
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Header labels, most specific first. */
const headerKinds: Array<{ kind: ColumnKind; pattern: RegExp }> = [
  // Amounts in another currency or exchange rates are never the amount
  {
    kind: 'other',
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

function parseHeader(line: Line): Column[] | null {
  // A row with a date or an amount is data, even with a "Debet" type cell
  if (line.cells.some(cell => parseDate(cell.text) || parseAmount(cell.text))) {
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

  const hasMoneyColumn = columns.some(column =>
    ['amount', 'debit', 'credit'].includes(column.kind),
  );
  return columns.length >= 2 && hasMoneyColumn ? columns : null;
}

const summaryPattern =
  /^(pocatecni|konecny|celkem|soucet|souhrn|obraty|zustatek|stav uctu|opening|closing|total|balance|strana|page)\b/;
const openingPattern =
  /^(pocatecni (zustatek|stav)|zustatek na zacatku|predchozi zustatek|opening balance|previous balance|starting balance)/;
const closingPattern =
  /^(konecny (zustatek|stav)|zustatek na konci|novy zustatek|closing balance|ending balance|new balance)/;

/** Totals, balances and page footers, which are not transactions. */
function parseSummaryLine(
  line: Line,
): { kind: 'opening' | 'closing' | 'other'; amount: number | null } | null {
  const texts = line.cells.map(cell => normalize(cell.text));
  if (!texts.some(text => summaryPattern.test(text))) {
    return null;
  }
  const amounts = findAmounts(line);
  const amount = amounts.length > 0 ? amounts[amounts.length - 1].value : null;
  const kind = texts.some(text => openingPattern.test(text))
    ? 'opening'
    : texts.some(text => closingPattern.test(text))
      ? 'closing'
      : 'other';
  return { kind, amount };
}

function mentionsBalance(line: Line) {
  return line.cells.some(cell =>
    /zustatek|balance|saldo/.test(normalize(cell.text)),
  );
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

const amountPattern =
  /^([+\-−]?)\s?(?:CZK|Kč|EUR|€|USD|\$)?\s?(\d{1,3}(?:[   .,'’]\d{3})*|\d+)[.,](\d{2})\s?(?:CZK|Kč|EUR|€|USD|\$)?\s?(-?)$/i;

export function parseAmount(
  text: string,
): { value: number; signed: boolean } | null {
  const match = text.trim().match(amountPattern);
  if (!match) {
    return null;
  }
  const [, leadingSign, integerPart, fraction, trailingMinus] = match;
  const value = Number(`${integerPart.replace(/\D/g, '')}.${fraction}`);
  const isNegative = leadingSign === '-' || leadingSign === '−';
  return {
    value: isNegative || trailingMinus ? -value : value,
    signed: leadingSign !== '' || trailingMinus !== '',
  };
}

function findAmounts(line: Line, dateCell?: Cell): FoundAmount[] {
  const amounts: FoundAmount[] = [];
  for (const cell of line.cells) {
    if (cell === dateCell) {
      continue;
    }
    const amount = parseAmount(cell.text);
    if (amount) {
      amounts.push({ ...amount, cell });
    }
  }
  return amounts;
}

function pickAmount(
  amounts: FoundAmount[],
  columns: Column[] | null,
): PickedAmount | null {
  if (amounts.length === 0) {
    return null;
  }

  if (columns && columns.length > 0) {
    // Assign every amount to its nearest header column and use the first
    // one in a money column. Zeros fill unused debit/credit columns. When
    // only the balance is left (the amount was blacked out), there is no
    // amount rather than a wrong one.
    for (const amount of amounts) {
      if (amount.value === 0) {
        continue;
      }
      const center = amount.cell.x + amount.cell.width / 2;
      let nearest = columns[0];
      for (const column of columns) {
        if (
          Math.abs(center - column.center) < Math.abs(center - nearest.center)
        ) {
          nearest = column;
        }
      }

      const magnitude = Math.abs(amount.value);
      switch (nearest.kind) {
        case 'debit':
          return {
            value: -magnitude,
            signed: true,
            fromDebitCreditColumn: true,
            cell: amount.cell,
          };
        case 'credit':
          return {
            value: magnitude,
            signed: true,
            fromDebitCreditColumn: true,
            cell: amount.cell,
          };
        case 'amount':
          return { ...amount, fromDebitCreditColumn: false };
        default:
          break;
      }
    }
    return null;
  }

  // Without a header, the first amount is the transaction amount and a
  // later one is usually the running balance
  return { ...amounts[0], fromDebitCreditColumn: false };
}

/** Text of a line without its date and the cells of the given amounts. */
function descriptionOf(line: Line, amountCells: Cell[], date?: FoundDate) {
  return line.cells
    .filter(cell => !amountCells.includes(cell))
    .map(cell =>
      cell === date?.cell ? cell.text.slice(date.length).trim() : cell.text,
    )
    .filter(text => text !== '' && !parseDate(text))
    .join(' ')
    .trim();
}

function overlapsRedaction(line: Line, redactions: StatementRect[]) {
  return redactions.some(
    rect =>
      rect.y < line.y + line.height + 1 && rect.y + rect.height > line.y - 1,
  );
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

  const reviewReasons: ReviewReason[] = [];
  if (pending.amount === null) {
    reviewReasons.push('missing-amount');
  } else if (pending.isAmountUncertain) {
    reviewReasons.push('uncertain-amount');
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
