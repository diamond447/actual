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
    expect(parseAmount('-1 234,56')).toEqual({ value: -1234.56, signed: true });
    expect(parseAmount('1 234,56 CZK')).toEqual({
      value: 1234.56,
      signed: false,
    });
    expect(parseAmount('+250,00 Kč')).toEqual({ value: 250, signed: true });
    expect(parseAmount('1,234.56')).toEqual({ value: 1234.56, signed: false });
    expect(parseAmount('−1.234,56')).toEqual({
      value: -1234.56,
      signed: true,
    });
    expect(parseAmount('99,90-')).toEqual({ value: -99.9, signed: true });
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
        date: '2026-03-05',
        amount: null,
        payee: 'Nájem',
        notes: 'Nájem',
        reviewReasons: ['missing-amount'],
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

    expect(result.transactions.map(t => t.amount)).toEqual([-312, null]);
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

  it('reports lines with money that are not transactions', () => {
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
        line(200, [40, 'Poplatek za vedení účtu'], [400, '-49,00']),
        line(
          220,
          [250, '03.03.2026'],
          [300, 'Posunutý řádek'],
          [400, '-10,00'],
        ),
        line(240, [40, 'Disponibilní zůstatek'], [500, '862,00']),
      ]),
      {
        width: 595,
        height: 842,
        items: [],
        redactions: [],
        isUnreadable: true,
      },
    ]);

    expect(result.transactions).toHaveLength(1);
    expect(result.unrecognizedLines).toEqual([
      {
        page: 1,
        text: 'Poplatek za vedení účtu  -49,00',
        reason: 'unmatched-line',
      },
      {
        page: 1,
        text: '03.03.2026  Posunutý řádek  -10,00',
        reason: 'unmatched-line',
      },
      { page: 2, text: '', reason: 'unreadable-page' },
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
