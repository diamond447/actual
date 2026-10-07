import { parseAmount, parseDate, parseStatement } from './parseStatement';
import type { StatementPage, StatementRect, StatementTextItem } from './types';

const LINE_HEIGHT = 8;

/** Build a line of text items from [x, text] pairs at the given y. */
function line(y: number, ...cells: Array<[number, string]>) {
  return cells.map(
    ([x, text]): StatementTextItem => ({
      text,
      x,
      y,
      width: text.length * 4,
      height: LINE_HEIGHT,
    }),
  );
}

function page(
  items: StatementTextItem[][],
  redactions: StatementRect[] = [],
): StatementPage {
  return { width: 595, height: 842, items: items.flat(), redactions };
}

describe('parseDate', () => {
  it('parses common statement date formats', () => {
    expect(parseDate('05.03.2026')).toBe('2026-03-05');
    expect(parseDate('5. 3. 2026')).toBe('2026-03-05');
    expect(parseDate('05.03.26')).toBe('2026-03-05');
    expect(parseDate('2026-03-05')).toBe('2026-03-05');
    expect(parseDate('05/03/2026')).toBe('2026-03-05');
  });

  it('rejects text that is not a date', () => {
    expect(parseDate('1 234,56')).toBeNull();
    expect(parseDate('31.13.2026')).toBeNull();
    expect(parseDate('31.02.2026')).toBeNull();
    expect(parseDate('Platba kartou')).toBeNull();
  });
});

describe('parseAmount', () => {
  it('parses Czech and English formats', () => {
    expect(parseAmount('-1 234,56')).toMatchObject({
      value: -1234.56,
      signed: true,
    });
    expect(parseAmount('1 234,56 CZK')).toMatchObject({
      value: 1234.56,
      signed: false,
    });
    expect(parseAmount('+250,00 Kč')).toMatchObject({
      value: 250,
      signed: true,
    });
    expect(parseAmount('1,234.56')).toMatchObject({
      value: 1234.56,
      signed: false,
    });
    expect(parseAmount('−1.234,56')).toMatchObject({
      value: -1234.56,
      signed: true,
    });
    expect(parseAmount('99,90-')).toMatchObject({ value: -99.9, signed: true });
  });

  it('rejects numbers that are not amounts', () => {
    expect(parseAmount('123456789')).toBeNull();
    expect(parseAmount('VS 1234')).toBeNull();
    expect(parseAmount('12,5')).toBeNull();
    expect(parseAmount('2026')).toBeNull();
  });
});

describe('parseStatement', () => {
  const header = line(
    100,
    [40, 'Datum'],
    [100, 'Popis transakce'],
    [400, 'Částka'],
    [500, 'Zůstatek'],
  );

  it('reads a statement with an amount and balance column', () => {
    const result = parseStatement([
      page([
        line(40, [40, 'Výpis z účtu za období 01.03.2026 - 31.03.2026']),
        line(80, [40, 'Počáteční zůstatek'], [500, '10 000,00']),
        header,
        line(
          120,
          [40, '02.03.2026'],
          [100, 'PLATBA KARTOU'],
          [400, '-249,00'],
          [500, '9 751,00'],
        ),
        line(129, [100, 'ALBERT 0123, PRAHA']),
        line(
          150,
          [40, '05.03.2026'],
          [100, 'PŘÍCHOZÍ PLATBA'],
          [400, '35 000,00'],
          [500, '44 751,00'],
        ),
        line(159, [100, 'ZAMESTNAVATEL S.R.O.']),
        line(168, [100, 'VS: 202603']),
        line(200, [40, 'Konečný zůstatek'], [500, '44 751,00']),
      ]),
    ]);

    expect(result.hasUncertainSigns).toBe(false);
    expect(result.transactions).toEqual([
      {
        date: '2026-03-02',
        amount: -249,
        payee: 'ALBERT 0123, PRAHA',
        notes: 'PLATBA KARTOU · ALBERT 0123, PRAHA',
        reviewReasons: [],
      },
      {
        date: '2026-03-05',
        amount: 35000,
        payee: 'ZAMESTNAVATEL S.R.O.',
        notes: 'PŘÍCHOZÍ PLATBA · ZAMESTNAVATEL S.R.O. · VS: 202603',
        reviewReasons: [],
      },
    ]);
  });

  it('handles two date columns', () => {
    const result = parseStatement([
      page([
        line(
          100,
          [40, 'Datum operace'],
          [110, 'Datum zaúčtování'],
          [180, 'Popis'],
          [420, 'Částka'],
          [510, 'Zůstatek'],
        ),
        line(
          120,
          [40, '01.03.2026'],
          [110, '03.03.2026'],
          [180, 'Lékárna Dr.Max'],
          [420, '-189,50'],
          [510, '1 000,00'],
        ),
      ]),
    ]);

    expect(result.transactions).toMatchObject([
      { date: '2026-03-01', amount: -189.5, payee: 'Lékárna Dr.Max' },
    ]);
  });

  it('uses debit and credit columns for the sign', () => {
    const result = parseStatement([
      page([
        line(
          100,
          [40, 'Datum'],
          [100, 'Popis'],
          [360, 'Výdaj'],
          [440, 'Příjem'],
          [520, 'Zůstatek'],
        ),
        line(
          120,
          [40, '02.03.2026'],
          [100, 'Nájem'],
          [360, '15 000,00'],
          [520, '5 000,00'],
        ),
        line(
          140,
          [40, '03.03.2026'],
          [100, 'Vrácení přeplatku'],
          [440, '1 200,00'],
          [520, '6 200,00'],
        ),
      ]),
    ]);

    expect(result.hasUncertainSigns).toBe(false);
    expect(result.transactions.map(t => t.amount)).toEqual([-15000, 1200]);
  });

  it('falls back to the first amount without a header', () => {
    const result = parseStatement([
      page([
        line(
          120,
          [40, '02.03.2026'],
          [100, 'Kavárna'],
          [400, '-89,00'],
          [500, '911,00'],
        ),
        line(
          140,
          [40, '03.03.2026'],
          [100, 'Pekárna'],
          [400, '-45,00'],
          [500, '866,00'],
        ),
      ]),
    ]);

    expect(result.transactions.map(t => [t.payee, t.amount])).toEqual([
      ['Kavárna', -89],
      ['Pekárna', -45],
    ]);
  });

  it('reports unsigned statements', () => {
    const result = parseStatement([
      page([line(120, [40, '02.03.2026'], [100, 'Kavárna'], [400, '89,00'])]),
    ]);

    expect(result.hasUncertainSigns).toBe(true);
  });

  it('keeps rows with a blacked-out amount for review', () => {
    const result = parseStatement([
      page(
        [
          header,
          line(120, [40, '02.03.2026'], [100, 'PLATBA KARTOU']),
          line(129, [100, 'Billa']),
          line(150, [40, '04.03.2026'], [400, '-120,00'], [500, '880,00']),
          line(170, [40, '05.03.2026'], [100, 'Nájem'], [500, '760,00']),
        ],
        [
          { x: 390, y: 119, width: 60, height: 10 },
          { x: 95, y: 149, width: 200, height: 10 },
        ],
      ),
    ]);

    expect(result.transactions).toEqual([
      {
        date: '2026-03-02',
        amount: null,
        payee: 'Billa',
        notes: 'PLATBA KARTOU · Billa',
        reviewReasons: ['missing-amount', 'redacted'],
      },
      {
        date: '2026-03-04',
        amount: -120,
        payee: '',
        notes: '',
        reviewReasons: ['missing-description', 'redacted'],
      },
      {
        // Filled in from the change of the running balance
        date: '2026-03-05',
        amount: -120,
        payee: 'Nájem',
        notes: 'Nájem',
        reviewReasons: ['amount-from-balance'],
      },
    ]);
  });

  it('continues the table on the next page', () => {
    const result = parseStatement([
      page([
        header,
        line(
          120,
          [40, '02.03.2026'],
          [100, 'Kavárna'],
          [400, '-89,00'],
          [500, '911,00'],
        ),
        line(800, [40, 'Strana 1 z 2']),
      ]),
      page([
        line(
          40,
          [40, '03.03.2026'],
          [100, 'Pekárna'],
          [400, '-45,00'],
          [500, '866,00'],
        ),
      ]),
    ]);

    expect(result.transactions.map(t => t.payee)).toEqual([
      'Kavárna',
      'Pekárna',
    ]);
  });

  it('merges text items that belong to the same cell', () => {
    const result = parseStatement([
      page([
        header,
        [
          { text: '02.03.2026', x: 40, y: 120, width: 40, height: 8 },
          { text: 'Potraviny', x: 100, y: 120, width: 36, height: 8 },
          { text: 'U', x: 138, y: 120, width: 4, height: 8 },
          { text: 'Nováků', x: 144, y: 120, width: 24, height: 8 },
          { text: '-1', x: 400, y: 120, width: 8, height: 8 },
          { text: ' 234,50', x: 408, y: 120, width: 28, height: 8 },
        ],
      ]),
    ]);

    expect(result.transactions).toMatchObject([
      { payee: 'Potraviny U Nováků', amount: -1234.5 },
    ]);
  });

  it('ignores zeros in the unused debit or credit column', () => {
    const result = parseStatement([
      page([
        line(
          100,
          [40, 'Datum'],
          [100, 'Popis'],
          [360, 'Debet'],
          [440, 'Kredit'],
          [520, 'Zůstatek'],
        ),
        line(
          120,
          [40, '02.03.2026'],
          [100, 'Výplata'],
          [360, '0,00'],
          [440, '35 000,00'],
          [520, '36 000,00'],
        ),
      ]),
    ]);

    expect(result.transactions.map(t => t.amount)).toEqual([35000]);
  });

  it('does not start rows from dates inside descriptions or summaries', () => {
    const result = parseStatement([
      page([
        header,
        line(
          120,
          [40, '02.03.2026'],
          [100, 'PLATBA KARTOU'],
          [400, '-249,00'],
          [500, '9 751,00'],
        ),
        line(129, [100, 'Datum transakce: 01.03.2026']),
        line(138, [100, 'ALBERT PRAHA']),
        line(
          160,
          [40, '31.03.2026'],
          [100, 'Konečný zůstatek'],
          [500, '9 751,00'],
        ),
        line(170, [40, 'Zůstatek k 31.03.2026'], [500, '9 751,00']),
      ]),
    ]);

    expect(result.transactions).toMatchObject([
      {
        amount: -249,
        payee: 'Datum transakce: 01.03.2026',
        notes: 'PLATBA KARTOU · Datum transakce: 01.03.2026 · ALBERT PRAHA',
      },
    ]);
  });

  it('never uses the balance or a foreign currency column as the amount', () => {
    const result = parseStatement([
      page(
        [
          line(
            100,
            [40, 'Datum'],
            [100, 'Popis'],
            [300, 'Částka v původní měně'],
            [420, 'Částka'],
            [500, 'Disponibilní zůstatek'],
          ),
          line(
            120,
            [40, '02.03.2026'],
            [100, 'Amazon'],
            [300, '-12,50 EUR'],
            [420, '-312,00'],
            [500, '9 688,00'],
          ),
          line(140, [40, '03.03.2026'], [100, 'Nájem'], [500, '1 000,00']),
        ],
        [{ x: 415, y: 139, width: 60, height: 10 }],
      ),
    ]);

    // The blacked-out amount comes from the balance, never the balance itself
    expect(
      result.transactions.map(t => [t.amount, t.reviewReasons[0]]),
    ).toEqual([
      [-312, undefined],
      [-8688, 'amount-from-balance'],
    ]);
  });

  it('keeps the description that shares a cell with the date', () => {
    const result = parseStatement([
      page([
        header,
        line(120, [40, '02.03.2026 PLATBA KARTOU'], [400, '-249,00']),
        line(129, [40, 'BILLA']),
      ]),
    ]);

    expect(result.transactions).toMatchObject([
      { date: '2026-03-02', payee: 'BILLA', notes: 'PLATBA KARTOU · BILLA' },
    ]);
  });

  it('reads an amount from the second line of a row', () => {
    const result = parseStatement([
      page([
        header,
        line(120, [40, '02.03.2026'], [100, 'Odchozí platba']),
        line(129, [100, 'Nájem'], [400, '-15 000,00'], [500, '1 000,00']),
      ]),
    ]);

    expect(result.transactions).toMatchObject([
      { amount: -15000, payee: 'Nájem', reviewReasons: [] },
    ]);
  });

  it('flags a lone amount next to a blacked-out area without a header', () => {
    const result = parseStatement([
      page(
        [line(120, [40, '02.03.2026'], [100, 'Kavárna'], [500, '911,00'])],
        [{ x: 395, y: 119, width: 60, height: 10 }],
      ),
    ]);

    expect(result.transactions[0].reviewReasons).toEqual([
      'uncertain-amount',
      'redacted',
    ]);
  });

  it('accounts for every amount on the statement', () => {
    const result = parseStatement([
      page([
        line(60, [40, 'Kontokorent'], [300, '5 000,00']),
        header,
        line(
          120,
          [40, '02.03.2026'],
          [100, 'Kavárna'],
          [400, '-89,00'],
          [500, '911,00'],
        ),
        line(200, [40, 'Poplatek za vedení účtu'], [400, '-49,00']),
        line(
          220,
          [250, '03.03.2026'],
          [300, 'Posunutý řádek'],
          [400, '-10,00'],
        ),
        line(240, [40, 'Disponibilní zůstatek'], [500, '852,00']),
      ]),
      {
        width: 595,
        height: 842,
        items: [],
        redactions: [],
        isUnreadable: true,
      },
    ]);

    expect(
      result.transactions.map(t => [
        t.date,
        t.payee,
        t.amount,
        t.reviewReasons,
      ]),
    ).toEqual([
      ['2026-03-02', 'Kavárna', -89, []],
      [
        '2026-03-02',
        'Poplatek za vedení účtu',
        -49,
        ['date-from-previous-row'],
      ],
      ['2026-03-03', 'Posunutý řádek', -10, []],
    ]);
    expect(result.unrecognizedLines).toEqual([
      { page: 1, text: 'Kontokorent  5 000,00', reason: 'unmatched-line' },
      { page: 2, text: '', reason: 'unreadable-page' },
    ]);
  });

  it('keeps payees that start like a summary', () => {
    const result = parseStatement([
      page([
        header,
        line(
          120,
          [40, '05.03.2026'],
          [100, 'TOTAL BENZINA PRAHA'],
          [400, '-1 200,00'],
        ),
        line(129, [100, 'Celkem natankováno 30 l']),
      ]),
    ]);

    expect(result.transactions).toMatchObject([
      {
        payee: 'TOTAL BENZINA PRAHA',
        amount: -1200,
        notes: 'TOTAL BENZINA PRAHA · Celkem natankováno 30 l',
      },
    ]);
  });

  it('fills in amounts and signs from the running balance', () => {
    const result = parseStatement([
      page([
        line(80, [40, 'Předchozí zůstatek'], [500, '1 000,00']),
        line(
          100,
          [40, 'Datum'],
          [100, 'Popis'],
          [400, 'Částka'],
          [500, 'Zůstatek'],
        ),
        line(
          120,
          [40, '02.03.2026'],
          [100, 'Výplata'],
          [400, '500,00'],
          [500, '1 500,00'],
        ),
        line(
          140,
          [40, '03.03.2026'],
          [100, 'Albert'],
          [400, '200,00'],
          [500, '1 300,00'],
        ),
        line(
          160,
          [40, '04.03.2026'],
          [100, 'Billa'],
          [400, '1 2OO,00'],
          [500, '1 250,00'],
        ),
        line(180, [40, 'Nový zůstatek'], [500, '1 250,00']),
      ]),
    ]);

    expect(
      result.transactions.map(t => [t.payee, t.amount, t.reviewReasons]),
    ).toEqual([
      ['Výplata', 500, []],
      ['Albert', -200, []],
      // The garbled amount is not taken from elsewhere: it is computed
      ['Billa', -50, ['amount-from-balance']],
    ]);
    expect(result.hasUncertainSigns).toBe(false);
    expect([result.openingBalance, result.closingBalance]).toEqual([
      1000, 1250,
    ]);
  });

  it('reads statements listed newest first', () => {
    const result = parseStatement([
      page([
        header,
        line(
          120,
          [40, '03.03.2026'],
          [100, 'Albert'],
          [400, '-200,00'],
          [500, '1 300,00'],
        ),
        line(140, [40, '02.03.2026'], [100, 'Nájem'], [500, '1 500,00']),
        line(
          160,
          [40, '01.03.2026'],
          [100, 'Výplata'],
          [400, '500,00'],
          [500, '1 000,00'],
        ),
      ]),
    ]);

    expect(result.transactions.map(t => [t.payee, t.amount])).toEqual([
      ['Albert', -200],
      // Read oldest first: 1 000 → 1 500
      ['Nájem', 500],
      ['Výplata', 500],
    ]);
  });

  it('reads the opening and closing balance', () => {
    const result = parseStatement([
      page([
        line(80, [40, 'Počáteční zůstatek'], [500, '10 000,00']),
        header,
        line(
          120,
          [40, '02.03.2026'],
          [100, 'Kavárna'],
          [400, '-89,00'],
          [500, '9 911,00'],
        ),
        line(200, [40, 'Konečný zůstatek k 31.03.2026'], [500, '9 911,00']),
      ]),
    ]);

    expect(result.openingBalance).toBe(10000);
    expect(result.closingBalance).toBe(9911);
  });

  it('reads several transactions listed under one date', () => {
    const result = parseStatement([
      page(
        [
          header,
          line(120, [40, '02.03.2026'], [100, 'Kavárna'], [400, '-89,00']),
          line(129, [100, 'Pekárna'], [400, '-45,00']),
          line(140, [40, '03.03.2026'], [100, 'Nájem']),
          line(149, [100, 'Billa'], [400, '-300,00']),
        ],
        [{ x: 395, y: 139, width: 60, height: 10 }],
      ),
    ]);

    expect(result.transactions.map(t => [t.date, t.payee, t.amount])).toEqual([
      ['2026-03-02', 'Kavárna', -89],
      ['2026-03-02', 'Pekárna', -45],
      ['2026-03-03', 'Nájem', null],
      ['2026-03-03', 'Billa', -300],
    ]);
  });
});

describe('parseStatement with rows blacked out on purpose', () => {
  const header = line(
    100,
    [40, 'Datum'],
    [100, 'Popis transakce'],
    [400, 'Částka'],
    [500, 'Zůstatek'],
  );
  /** A table row hidden completely: date, description, amount, balance. */
  const blackedOutRow = (y: number): StatementRect[] => [
    // dates sit a little right of the "Datum" header
    { x: 47, y, width: 40, height: LINE_HEIGHT },
    { x: 100, y, width: 120, height: LINE_HEIGHT },
    { x: 400, y, width: 30, height: LINE_HEIGHT },
    { x: 500, y, width: 40, height: LINE_HEIGHT },
  ];
  const row = (
    y: number,
    date: string,
    text: string,
    amount: string,
    balance: string,
  ) => line(y, [40, date], [100, text], [400, amount], [500, balance]);

  it('lists hidden rows as one skipped entry with the total from the balances', () => {
    const result = parseStatement([
      page(
        [
          header,
          row(120, '02.03.2026', 'ALBERT', '-249,00', '9 751,00'),
          // two rows blacked out at 140 and 160 moved -1 000,00 together
          row(180, '05.03.2026', 'LIDL', '-100,00', '8 651,00'),
        ],
        [...blackedOutRow(140), ...blackedOutRow(160)],
      ),
    ]);

    expect(
      result.transactions.map(t => [
        t.payee,
        t.amount,
        t.blackedOutRows,
        t.reviewReasons,
      ]),
    ).toEqual([
      ['ALBERT', -249, undefined, []],
      ['', -1000, 2, ['blacked-out-rows']],
      ['LIDL', -100, undefined, []],
    ]);
    expect(result.unrecognizedLines).toEqual([]);
  });

  it('keeps hidden rows apart when a visible row sits between them', () => {
    const result = parseStatement([
      page(
        [
          header,
          row(120, '02.03.2026', 'ALBERT', '-249,00', '9 751,00'),
          row(150, '03.03.2026', 'BILLA', '-51,00', '9 600,00'),
          row(180, '05.03.2026', 'LIDL', '-100,00', '9 000,00'),
        ],
        [...blackedOutRow(135), ...blackedOutRow(165)],
      ),
    ]);

    expect(
      result.transactions.map(t => [t.amount, t.blackedOutRows ?? null]),
    ).toEqual([
      [-249, null],
      // 9 751 → 9 600 minus BILLA's -51,00 leaves -100,00 for the hidden row
      [-100, 1],
      [-51, null],
      [-500, 1],
      [-100, null],
    ]);
  });

  it('leaves the total unknown when no balance comes before the hidden rows', () => {
    const result = parseStatement([
      page(
        [header, row(140, '02.03.2026', 'ALBERT', '-249,00', '9 751,00')],
        blackedOutRow(120),
      ),
    ]);

    expect(result.transactions[0]).toMatchObject({
      date: '2026-03-02',
      amount: null,
      blackedOutRows: 1,
      reviewReasons: ['blacked-out-rows'],
    });
  });

  it('does not treat blacked-out details of a visible row as a hidden row', () => {
    const result = parseStatement([
      page(
        [
          header,
          row(120, '02.03.2026', 'ALBERT', '-249,00', '9 751,00'),
          line(129, [40, 'x']),
        ],
        // only the second line of the description is blacked out
        [{ x: 100, y: 129, width: 120, height: LINE_HEIGHT }],
      ),
    ]);

    expect(result.transactions.some(t => t.blackedOutRows)).toBe(false);
  });
});

describe('parseStatement column matching', () => {
  it('reads right-aligned numbers under left-aligned headers', () => {
    const cells = (y: number, ...rest: Array<[number, string, number]>) =>
      rest.map(([x, text, width]) => ({ text, x, y, width, height: 8 }));
    // Like mBank: "Částka" starts at 414 and amounts end at 475, balances
    // end at 552 under "Zůstatek" at 481
    const result = parseStatement([
      page([
        cells(
          100,
          [44, 'Datum', 20],
          [162, 'Popis', 20],
          [414, 'Částka', 24],
          [481, 'Zůstatek', 32],
        ),
        cells(
          120,
          [51, '10.03.2026', 40],
          [162, 'VÝPLATA', 30],
          [436, '42 350,00', 39],
          [513, '59 785,50', 39],
        ),
        cells(
          140,
          [51, '15.03.2026', 40],
          [162, 'NÁJEM', 30],
          [432, '-15 000,00', 43],
          [513, '44 785,50', 39],
        ),
        cells(
          160,
          [51, '16.03.2026', 40],
          [162, 'ALBERT', 30],
          [453, '-9,90', 22],
          [513, '44 775,60', 39],
        ),
      ]),
    ]);

    expect(result.transactions.map(t => t.amount)).toEqual([
      42350, -15000, -9.9,
    ]);
    expect(result.unrecognizedLines).toEqual([]);
  });
});

describe('parseStatement edge cases around blacked-out areas', () => {
  const header = line(
    100,
    [40, 'Datum'],
    [100, 'Popis transakce'],
    [400, 'Částka'],
    [500, 'Zůstatek'],
  );
  const row = (
    y: number,
    date: string,
    text: string,
    amount: string,
    balance: string,
  ) => line(y, [40, date], [100, text], [400, amount], [500, balance]);
  const box = (x: number, y: number, width: number) => ({
    x,
    y,
    width,
    height: LINE_HEIGHT,
  });

  it('ignores blacked-out text above a repeated header and below the table', () => {
    const result = parseStatement([
      page([header, row(120, '02.03.2026', 'ALBERT', '-249,00', '9 751,00')]),
      page(
        [
          header,
          row(120, '05.03.2026', 'LIDL', '-100,00', '9 651,00'),
          line(140, [40, 'Konečný zůstatek'], [500, '9 651,00']),
        ],
        // account holder above the header, signature box below the table
        [box(40, 50, 520), box(40, 400, 520)],
      ),
    ]);

    expect(result.transactions.some(t => t.blackedOutRows)).toBe(false);
  });

  it('does not mistake a blacked-out detail line for a hidden row', () => {
    const result = parseStatement([
      page(
        [
          header,
          row(120, '02.03.2026', 'ALBERT', '-249,00', '9 751,00'),
          row(140, '03.03.2026', 'LIDL', '-10,00', '9 651,00'),
        ],
        // the counterparty account line under ALBERT
        [box(40, 129, 160)],
      ),
    ]);

    expect(result.transactions.some(t => t.blackedOutRows)).toBe(false);
    // so the misread amount is still caught by the balance
    expect(result.transactions[1].reviewReasons).toContain('balance-mismatch');
  });

  it('ignores a blacked-out footer far below the last row of a page', () => {
    const result = parseStatement([
      page(
        [header, row(120, '02.03.2026', 'ALBERT', '-249,00', '9 751,00')],
        [box(40, 800, 520)],
      ),
      page([header, row(120, '05.03.2026', 'LIDL', '-10,00', '9 651,00')]),
    ]);

    expect(result.transactions.some(t => t.blackedOutRows)).toBe(false);
    expect(result.transactions[1].reviewReasons).toContain('balance-mismatch');
  });

  it('treats a full-width box over one detail line as part of the row above', () => {
    const result = parseStatement([
      page(
        [
          header,
          row(120, '02.03.2026', 'ALBERT', '-249,00', '9 751,00'),
          row(140, '03.03.2026', 'LIDL', '-10,00', '9 651,00'),
        ],
        [box(40, 129, 520)],
      ),
    ]);

    expect(result.transactions.some(t => t.blackedOutRows)).toBe(false);
    expect(result.transactions[1].reviewReasons).toContain('balance-mismatch');
  });

  it('leaves one box over a whole row to the balance check', () => {
    const result = parseStatement([
      page(
        [
          header,
          row(120, '02.03.2026', 'ALBERT', '-249,00', '9 751,00'),
          row(160, '05.03.2026', 'LIDL', '-100,00', '8 651,00'),
        ],
        // date line and two description lines under one box
        [{ x: 40, y: 135, width: 520, height: 20 }],
      ),
    ]);

    expect(result.transactions.some(t => t.blackedOutRows)).toBe(false);
    expect(result.transactions[1].reviewReasons).toContain('balance-mismatch');
  });

  it('does not let a far tall box absorb a misread amount', () => {
    const result = parseStatement([
      page(
        [header, row(120, '02.03.2026', 'ALBERT', '-249,00', '9 751,00')],
        [
          box(40, 360, 40),
          box(400, 360, 30),
          { x: 40, y: 360, width: 520, height: 60 },
        ],
      ),
      page([header, row(120, '05.03.2026', 'LIDL', '-180,00', '9 651,00')]),
    ]);

    expect(result.transactions.some(t => t.blackedOutRows)).toBe(false);
    expect(result.transactions[1].reviewReasons).toContain('balance-mismatch');
  });

  it('keeps numbers in descriptions out of the amount column', () => {
    const result = parseStatement([
      page(
        [
          header,
          row(120, '02.03.2026', 'ALBERT', '-249,00', '9 751,00'),
          line(129, [100, 'Kurz'], [300, '25,10']),
          row(160, '05.03.2026', 'LIDL', '-100,00', '8 651,00'),
        ],
        [box(40, 140, 40), box(400, 140, 30), box(500, 140, 40)],
      ),
    ]);

    expect(result.transactions.map(t => t.amount)).toEqual([-249, -1000, -100]);
  });

  it('keeps finding hidden rows below a summary box above the table', () => {
    const result = parseStatement([
      page(
        [
          line(40, [40, 'Počáteční zůstatek'], [500, '10 000,00']),
          line(50, [40, 'Konečný zůstatek'], [500, '8 651,00']),
          header,
          row(120, '02.03.2026', 'ALBERT', '-249,00', '9 751,00'),
          row(160, '05.03.2026', 'LIDL', '-100,00', '8 651,00'),
        ],
        [box(40, 140, 40), box(400, 140, 30), box(500, 140, 40)],
      ),
    ]);

    expect(result.transactions[1]).toMatchObject({
      amount: -1000,
      blackedOutRows: 1,
    });
  });

  it('counts hidden rows with a stray character peeking out of a box', () => {
    const result = parseStatement([
      page(
        [
          header,
          row(120, '02.03.2026', 'ALBERT', '-249,00', '9 751,00'),
          // the last digit of the balance shows next to its box
          line(140, [541, '9']),
          row(160, '05.03.2026', 'LIDL', '-100,00', '8 651,00'),
        ],
        [box(40, 140, 40), box(400, 140, 30), box(500, 140, 40)],
      ),
    ]);

    expect(result.transactions[1]).toMatchObject({
      amount: -1000,
      blackedOutRows: 1,
    });
  });

  it('keeps counting hidden rows that continue from the previous page', () => {
    const hiddenRow = (y: number) => [
      box(40, y, 40),
      box(100, y, 120),
      box(400, y, 30),
      box(500, y, 40),
      // two description lines under the row
      box(100, y + 10, 100),
      box(100, y + 20, 100),
    ];
    const result = parseStatement([
      page(
        [header, row(120, '02.03.2026', 'ALBERT', '-249,00', '9 751,00')],
        hiddenRow(140),
      ),
      page(
        [header, row(220, '05.03.2026', 'LIDL', '-100,00', '8 651,00')],
        [...hiddenRow(120), ...hiddenRow(170)],
      ),
    ]);

    expect(result.transactions[1]).toMatchObject({
      amount: -1000,
      blackedOutRows: 3,
    });
  });

  it('never moves a number from an exchange rate column into the amount', () => {
    const cells = (y: number, ...rest: Array<[number, string, number]>) =>
      rest.map(([x, text, width]) => ({ text, x, y, width, height: 8 }));
    const result = parseStatement([
      page([
        cells(
          100,
          [40, 'Datum', 20],
          [100, 'Popis', 20],
          [400, 'Částka CZK', 40],
          [456, 'Kurz', 16],
          [510, 'Zůstatek', 30],
        ),
        cells(
          120,
          [40, '02.03.2026', 40],
          [100, 'ALBERT', 30],
          [410, '-249,00', 30],
          [500, '9 751,00', 40],
        ),
        cells(129, [100, 'Platba v EUR', 40], [452, '25,10', 20]),
      ]),
    ]);

    expect(result.transactions.map(t => t.amount)).toEqual([-249]);
    expect(result.unrecognizedLines).toHaveLength(1);
  });

  it('flags the row after hidden rows when signs cannot be checked', () => {
    const unsigned = (y: number, date: string, amount: string, bal: string) =>
      line(y, [40, date], [100, 'X'], [400, amount], [500, bal]);
    const result = parseStatement([
      page(
        [
          header,
          unsigned(120, '02.03.2026', '249,00', '9 751,00'),
          unsigned(160, '05.03.2026', '100,00', '8 651,00'),
          unsigned(180, '06.03.2026', '51,00', '8 600,00'),
        ],
        [box(40, 140, 40), box(400, 140, 30), box(500, 140, 40)],
      ),
    ]);

    expect(result.transactions[2].reviewReasons).toContain('unchecked-sign');
    expect(result.hasUncertainSigns).toBe(true);
  });

  it('reads wide right-aligned numbers under short headers', () => {
    const cells = (y: number, ...rest: Array<[number, string, number]>) =>
      rest.map(([x, text, width]) => ({ text, x, y, width, height: 8 }));
    const result = parseStatement([
      page([
        cells(
          100,
          [40, 'Datum', 30],
          [100, 'Popis', 30],
          [380, 'Výdej', 30],
          [440, 'Příjem', 30],
          [510, 'Zůstatek', 30],
        ),
        cells(
          120,
          [40, '02.03.2026', 40],
          [100, 'VÝPLATA', 30],
          [400, '112 345,00 CZK', 70],
          [480, '113 345,00', 60],
        ),
        cells(
          140,
          [40, '03.03.2026', 40],
          [100, 'NÁJEM', 30],
          [365, '15 000,00', 45],
          [480, '98 345,00', 60],
        ),
      ]),
    ]);

    expect(result.transactions.map(t => t.amount)).toEqual([112345, -15000]);
  });
});

describe('parseStatement bank layouts', () => {
  const box = (x: number, y: number, width: number): StatementRect => ({
    x,
    y,
    width,
    height: LINE_HEIGHT,
  });

  it('reads rows printed on several lines under a stacked header', () => {
    const result = parseStatement([
      page([
        line(40, [40, 'Počáteční zůstatek:'], [250, '1 000.00']),
        line(56, [40, 'Příjmy celkem:'], [250, '1 200.00']),
        line(72, [40, 'Výdaje celkem:'], [250, '250.00']),
        line(88, [40, 'Konečný zůstatek:'], [250, '1 950.00']),
        line(
          120,
          [40, 'Datum'],
          [100, 'Kategorie transakce'],
          [200, 'Typ transakce'],
          [360, 'VS'],
          [520, 'Částka'],
        ),
        line(
          132,
          [40, 'Valuta'],
          [100, 'Číslo protiúčtu'],
          [200, 'Zpráva'],
          [360, 'KS'],
          [480, 'Původní částka'],
        ),
        line(
          144,
          [40, 'Kód transakce'],
          [100, 'Název protiúčtu'],
          [200, 'Poznámka'],
          [360, 'SS'],
          [530, 'Kurz'],
        ),
        line(
          160,
          [40, '13. 8. 2026'],
          [100, 'Nákup'],
          [200, 'Platba kartou'],
          [510, '-250.00 CZK'],
        ),
        line(172, [40, '13. 8. 2026'], [100, '123-456/0100'], [200, 'VS:1']),
        line(184, [40, '1234567890'], [100, 'ALBERT'], [200, 'Nákup']),
        line(
          200,
          [40, '17. 8. 2026'],
          [100, 'Příjem'],
          [200, 'Příchozí platba'],
          [510, '1 200.00 CZK'],
        ),
        // a payment in another currency with its exchange rate
        line(212, [40, '15. 8. 2026'], [100, 'DE89/0001'], [490, '48.00 EUR']),
        line(224, [40, '1234567891'], [100, 'FIRMA'], [530, '25.00']),
      ]),
    ]);

    expect(result.transactions.map(t => [t.date, t.amount])).toEqual([
      ['2026-08-13', -250],
      ['2026-08-17', 1200],
    ]);
    expect(result.transactions[0].notes).toContain('ALBERT');
    expect(result.unrecognizedLines).toEqual([]);
    expect(result.openingBalance).toBe(1000);
    expect(result.closingBalance).toBe(1950);
  });

  const stackedHeader = [
    line(100, [40, 'Datum'], [100, 'Popis'], [520, 'Částka']),
    line(112, [40, 'Valuta'], [100, 'Zpráva'], [480, 'Původní částka']),
    line(124, [40, 'Kód transakce'], [100, 'Poznámka'], [530, 'Kurz']),
  ];

  it('starts a new row at a date where the stacked header has none', () => {
    const result = parseStatement([
      page([
        ...stackedHeader,
        // a fee row printed on two lines only
        line(140, [40, '13. 8. 2026'], [100, 'Poplatek'], [510, '-50.00 CZK']),
        line(152, [40, '13. 8. 2026'], [100, 'Vedení účtu']),
        line(164, [40, '14. 8. 2026'], [100, 'Nákup'], [510, '-250.00 CZK']),
        line(176, [40, '14. 8. 2026'], [100, 'ALBERT']),
        line(188, [40, '1234567890'], [100, 'Karta']),
      ]),
    ]);

    expect(result.transactions.map(t => [t.date, t.amount])).toEqual([
      ['2026-08-13', -50],
      ['2026-08-14', -250],
    ]);
  });

  it('reads stacked rows on a page before the stacked header', () => {
    const result = parseStatement([
      page([
        line(140, [40, '13. 8. 2026'], [100, 'Nákup'], [510, '-250.00 CZK']),
        line(152, [40, '15. 8. 2026'], [100, 'DE89/0001'], [490, '48.00 EUR']),
        line(164, [40, '1234567891'], [100, 'FIRMA'], [530, '25.00']),
      ]),
      page([
        ...stackedHeader,
        line(140, [40, '17. 8. 2026'], [100, 'Příjem'], [510, '1 200.00 CZK']),
      ]),
    ]);

    expect(result.transactions.map(t => t.amount)).toEqual([-250, 1200]);
  });

  it('does not take the header of a different table on a later page', () => {
    const row = (y: number, date: string, amount: string, balance: string) =>
      line(y, [47, date], [100, 'ALBERT'], [400, amount], [500, balance]);
    const result = parseStatement([
      page([
        line(80, [40, 'Počáteční zůstatek:'], [500, '1 000,00']),
        row(120, '02.03.2026', '-249,00', '751,00'),
        row(140, '03.03.2026', '-100,00', '651,00'),
      ]),
      page([
        line(
          100,
          [40, 'Datum'],
          [100, 'Popis'],
          [380, 'Kurz'],
          [480, 'Částka'],
        ),
        line(120, [40, '31.03.2026'], [100, 'Poplatek'], [470, '-10,00']),
      ]),
    ]);

    expect(result.transactions.slice(0, 2).map(t => t.amount)).toEqual([
      -249, -100,
    ]);
  });

  it('ends a stacked row at the closing balance right below it', () => {
    const result = parseStatement([
      page([
        line(100, [40, 'Datum'], [100, 'Popis'], [520, 'Částka']),
        line(112, [40, 'Valuta'], [100, 'Zpráva'], [490, 'Původní částka']),
        line(128, [40, '13. 8. 2026'], [100, 'ALBERT'], [510, '-250.00 CZK']),
        line(140, [40, 'Konečný zůstatek:'], [510, '750.00 CZK']),
      ]),
    ]);

    expect(result.transactions.map(t => t.amount)).toEqual([-250]);
    expect(result.closingBalance).toBe(750);
  });

  it('keeps dated rows apart under a header whose labels only wrap', () => {
    const result = parseStatement([
      page([
        line(100, [40, 'Datum'], [100, 'Popis'], [400, 'Částka']),
        line(110, [40, 'zaúčtování'], [100, 'transakce']),
        line(130, [40, '02.03.2026'], [100, 'ALBERT']),
        line(140, [40, '03.03.2026'], [100, 'LIDL'], [400, '-100,00']),
      ]),
    ]);

    expect(result.transactions.map(t => [t.date, t.amount])).toEqual([
      ['2026-03-02', null],
      ['2026-03-03', -100],
    ]);
  });

  const header = (y: number) =>
    line(
      y,
      [40, 'Datum'],
      [100, 'Popis transakce'],
      [400, 'Částka'],
      [500, 'Zůstatek'],
    );
  const row = (
    y: number,
    date: string,
    text: string,
    amount: string,
    balance: string,
  ) => line(y, [47, date], [100, text], [400, amount], [500, balance]);
  /** Boxes over the header labels, which start where the labels do. */
  const blackedOutHeader = (y: number) => [
    box(40, y, 20),
    box(100, y, 60),
    box(400, y, 24),
    box(500, y, 32),
  ];
  /** A table row hidden completely: date, description, amount, balance. */
  const blackedOutRow = (y: number) => [
    box(47, y, 40),
    box(100, y, 120),
    box(404, y, 26),
    box(506, y, 34),
  ];

  it('uses the header of a later page on a page whose header is missing', () => {
    const result = parseStatement([
      page([
        line(80, [40, 'Počáteční zůstatek:'], [500, '1 000,00']),
        row(120, '02.03.2026', 'ALBERT', '-249,00', '751,00'),
      ]),
      page([header(100), row(120, '05.03.2026', 'LIDL', '-100,00', '651,00')]),
    ]);

    expect(result.transactions.map(t => [t.amount, t.reviewReasons])).toEqual([
      [-249, []],
      [-100, []],
    ]);
    expect(result.unrecognizedLines).toEqual([]);
  });

  it('starts the table below a blacked-out header', () => {
    const result = parseStatement([
      page(
        [
          line(80, [40, 'Počáteční zůstatek:'], [500, '1 000,00']),
          row(140, '02.03.2026', 'ALBERT', '-249,00', '651,00'),
        ],
        [...blackedOutHeader(100), ...blackedOutRow(120)],
      ),
      page([header(100), row(120, '05.03.2026', 'LIDL', '-100,00', '551,00')]),
    ]);

    expect(
      result.transactions.map(t => [t.amount, t.blackedOutRows ?? null]),
    ).toEqual([
      // 1 000 → 651 minus ALBERT's -249,00 leaves -100,00 for the hidden row
      [-100, 1],
      [-249, null],
      [-100, null],
    ]);
  });

  it('does not count a blacked-out balance above a blacked-out header', () => {
    const result = parseStatement([
      page(
        [row(140, '02.03.2026', 'ALBERT', '-249,00', '651,00')],
        [
          // the opening balance, label and amount
          box(40, 80, 70),
          box(500, 80, 40),
          ...blackedOutHeader(100),
          ...blackedOutRow(120),
        ],
      ),
      page([header(100), row(120, '05.03.2026', 'LIDL', '-100,00', '551,00')]),
    ]);

    expect(result.transactions[0]).toMatchObject({
      amount: null,
      blackedOutRows: 1,
    });
  });

  it('finds hidden rows on a last page that only has the closing balance', () => {
    const result = parseStatement([
      page([
        line(80, [40, 'Počáteční zůstatek:'], [500, '1 000,00']),
        header(100),
        row(120, '02.03.2026', 'ALBERT', '-249,00', '751,00'),
      ]),
      page(
        [line(160, [40, 'Konečný zůstatek:'], [500, '91,00'])],
        [
          ...blackedOutHeader(100),
          ...blackedOutRow(120),
          ...blackedOutRow(130),
        ],
      ),
    ]);

    expect(
      result.transactions.map(t => [t.amount, t.blackedOutRows ?? null]),
    ).toEqual([
      [-249, null],
      [-660, 2],
    ]);
  });

  it('reads rows dated left of the only recognized date column', () => {
    const result = parseStatement([
      page([
        // the first label lost a letter when the file was printed again
        line(
          100,
          [44, 'Datu'],
          [105, 'Datum'],
          [162, 'Popis transakce'],
          [414, 'Částka'],
          [481, 'Zůstatek'],
        ),
        line(
          120,
          [51, '02.03.2026'],
          [110, '02.03.2026'],
          [162, 'ALBERT'],
          [447, '-249,00'],
          [516, '751,00'],
        ),
      ]),
    ]);

    expect(result.transactions.map(t => [t.date, t.amount])).toEqual([
      ['2026-03-02', -249],
    ]);
    expect(result.unrecognizedLines).toEqual([]);
  });

  it('does not read a dated footer at the page margin as a row', () => {
    const result = parseStatement([
      page([
        line(100, [105, 'Datum'], [162, 'Popis'], [414, 'Částka']),
        line(120, [105, '02.03.2026'], [162, 'ALBERT'], [447, '-249,00']),
        line(800, [20, '31.03.2026 Vytištěno'], [300, 'Strana 1/1']),
      ]),
    ]);

    expect(result.transactions.map(t => t.amount)).toEqual([-249]);
  });
});
