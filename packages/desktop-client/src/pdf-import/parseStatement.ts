import type {
  ParsedStatement,
  ParsedStatementTransaction,
  ReviewReason,
  StatementPage,
  StatementRect,
  StatementTextItem,
} from './types';

/**
 * Bank-independent parser for the text of a PDF bank statement.
 *
 * The text is grouped into lines and cells by position. A transaction
 * starts on a line that has a date near the left edge; its amount is taken
 * from the amount column found in the table header (or, without a header,
 * the first amount on the line), and lines below it without a date are
 * added to its description.
 */
export function parseStatement(pages: StatementPage[]): ParsedStatement {
  const transactions: ParsedStatementTransaction[] = [];
  let columns: Columns | null = null;
  let hasSignedAmounts = false;
  let usesDebitCreditColumns = false;

  for (const page of pages) {
    const lines = groupLines(page.items);
    let current: PendingTransaction | null = null;

    const finish = () => {
      if (current) {
        transactions.push(toTransaction(current, page.redactions));
        current = null;
      }
    };

    for (const line of lines) {
      const header = parseHeader(line);
      if (header) {
        finish();
        columns = header;
        continue;
      }

      if (isSummaryLine(line)) {
        finish();
        continue;
      }

      const date = findLeadingDate(line, page.width);
      if (date) {
        const amounts = findAmounts(line, date.cell);
        if (amounts.length === 0 && !columns) {
          // Dates outside of a transaction table, e.g. the statement period
          finish();
          continue;
        }

        finish();
        const amount = pickAmount(amounts, columns);
        if (amount?.signed) {
          hasSignedAmounts = true;
        }
        if (amount?.fromDebitCreditColumn) {
          usesDebitCreditColumns = true;
        }

        current = {
          date: date.value,
          amount: amount?.value ?? null,
          descriptionLines: [descriptionOf(line, amounts, date.cell)].filter(
            Boolean,
          ),
          top: line.y,
          bottom: line.y + line.height,
        };
        continue;
      }

      if (current) {
        const isContinuation =
          line.y - current.bottom < line.height * 2.5 &&
          findAmounts(line).length === 0;
        if (isContinuation) {
          const text = descriptionOf(line, []);
          if (text) {
            current.descriptionLines.push(text);
          }
          current.bottom = line.y + line.height;
        } else {
          finish();
        }
      }
    }

    finish();
  }

  return {
    transactions,
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

type ColumnKind = 'amount' | 'debit' | 'credit' | 'balance';

type Columns = Array<{ kind: ColumnKind; center: number }>;

type FoundAmount = {
  value: number;
  signed: boolean;
  cell: Cell;
};

type PickedAmount = {
  value: number;
  signed: boolean;
  fromDebitCreditColumn: boolean;
};

type PendingTransaction = {
  date: string;
  amount: number | null;
  descriptionLines: string[];
  top: number;
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
    const height = Math.max(...row.map(item => item.height));
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

const headerKeywords: Array<{ kind: ColumnKind | 'other'; pattern: RegExp }> =
  [
    { kind: 'balance', pattern: /^(zustatek|balance|saldo)\b/ },
    {
      kind: 'debit',
      pattern: /^(debet|vydaj|vydej|odchozi|withdrawals?|debit|ma dati)\b/,
    },
    {
      kind: 'credit',
      pattern: /^(kredit|prijem|prichozi|deposits?|credit|dal)\b/,
    },
    { kind: 'amount', pattern: /^(castka|amount|obrat|suma)\b/ },
    {
      kind: 'other',
      pattern:
        /^(datum|date|popis|description|detail|nazev|protistrana|zprava|typ|operace|transakce|ucet|variabilni|vs|ks|ss)\b/,
    },
  ];

function parseHeader(line: Line): Columns | null {
  let matches = 0;
  const columns: Columns = [];
  for (const cell of line.cells) {
    const text = normalize(cell.text);
    const keyword = headerKeywords.find(({ pattern }) => pattern.test(text));
    if (!keyword) {
      continue;
    }
    matches++;
    if (keyword.kind !== 'other') {
      columns.push({ kind: keyword.kind, center: cell.x + cell.width / 2 });
    }
  }

  const hasMoneyColumn = columns.some(column => column.kind !== 'balance');
  return matches >= 2 && hasMoneyColumn ? columns : null;
}

const summaryPattern =
  /^(pocatecni|konecny|celkem|soucet|souhrn|obraty|opening|closing|total|strana|page)\b/;

function isSummaryLine(line: Line) {
  const first = line.cells[0];
  return first ? summaryPattern.test(normalize(first.text)) : false;
}

const datePatterns: Array<{
  pattern: RegExp;
  toParts: (match: RegExpMatchArray) => [string, string, string];
}> = [
  {
    pattern: /(?<!\d)(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4}|\d{2})(?![\d.,])/,
    toParts: match => [match[3], match[2], match[1]],
  },
  {
    pattern: /(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/,
    toParts: match => [match[1], match[2], match[3]],
  },
  {
    pattern: /(?<!\d)(\d{1,2})\/(\d{1,2})\/(\d{4})(?!\d)/,
    toParts: match => [match[3], match[2], match[1]],
  },
];

export function parseDate(text: string): string | null {
  for (const { pattern, toParts } of datePatterns) {
    const match = text.match(pattern);
    if (!match) {
      continue;
    }
    const [rawYear, rawMonth, rawDay] = toParts(match);
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    const month = Number(rawMonth);
    const day = Number(rawDay);
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      continue;
    }
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return null;
}

/** A date in one of the first cells, in the left part of the page. */
function findLeadingDate(line: Line, pageWidth: number) {
  for (const cell of line.cells.slice(0, 2)) {
    if (cell.x > pageWidth * 0.4) {
      break;
    }
    const value = parseDate(cell.text);
    if (value) {
      return { value, cell };
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
  columns: Columns | null,
): PickedAmount | null {
  if (amounts.length === 0) {
    return null;
  }

  if (columns && columns.length > 0) {
    // Assign every amount to its nearest column and use the first one that
    // is not the balance. When only the balance is left (the amount was
    // blacked out), there is no amount rather than a wrong one.
    for (const amount of amounts) {
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
      if (nearest.kind === 'debit') {
        return { value: -magnitude, signed: true, fromDebitCreditColumn: true };
      }
      if (nearest.kind === 'credit') {
        return { value: magnitude, signed: true, fromDebitCreditColumn: true };
      }
      if (nearest.kind === 'amount') {
        return {
          value: amount.value,
          signed: amount.signed,
          fromDebitCreditColumn: false,
        };
      }
    }
    return null;
  }

  // Without a header, the first amount is the transaction amount and a
  // later one is usually the running balance
  return {
    value: amounts[0].value,
    signed: amounts[0].signed,
    fromDebitCreditColumn: false,
  };
}

function descriptionOf(line: Line, amounts: FoundAmount[], dateCell?: Cell) {
  const amountCells = new Set(amounts.map(amount => amount.cell));
  return line.cells
    .filter(cell => cell !== dateCell && !amountCells.has(cell))
    .map(cell => cell.text)
    .filter(text => !parseDate(text) || text.length > 12)
    .join(' ')
    .trim();
}

const transactionTypePattern =
  /^(platba kartou|platba|odchozi( okamzita)? platba|prichozi( okamzita)? platba|odchozi uhrada|prichozi uhrada|trvaly prikaz|inkaso|sipo|vyber (z bankomatu|hotovosti)|vklad|poplatek|uroky?|card payment|payment|transfer|direct debit|standing order|atm withdrawal|incoming payment|outgoing payment)\b/;

const referencePattern =
  /^((vs|ks|ss)[:\s]|variabilni|konstantni|specificky|cislo karty|\*{2,}|x{4,}|\d[\d\s/-]{5,}$)/;

function toTransaction(
  pending: PendingTransaction,
  redactions: StatementRect[],
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
  }
  if (lines.length === 0) {
    reviewReasons.push('missing-description');
  }
  const isRedacted = redactions.some(
    rect =>
      rect.y < pending.bottom + 1 && rect.y + rect.height > pending.top - 1,
  );
  if (isRedacted) {
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
