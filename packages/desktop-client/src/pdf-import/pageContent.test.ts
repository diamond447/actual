import {
  measureArea,
  removeHiddenText,
  textItemsFromContent,
} from './pageContent';
import type { PagePixels } from './pageContent';

type Fill = [left: number, top: number, width: number, height: number];

/** A white page (in pixels) with rectangles in the given gray levels. */
function pixels(
  width: number,
  height: number,
  fills: Array<{ rect: Fill; level: number }>,
): PagePixels {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (const {
    rect: [left, top, rectWidth, rectHeight],
    level,
  } of fills) {
    for (let y = top; y < top + rectHeight; y++) {
      for (let x = left; x < left + rectWidth; x++) {
        const i = (y * width + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = level;
      }
    }
  }
  return { width, height, data };
}

const black = (...rect: Fill) => ({ rect, level: 0 });
const gray = (...rect: Fill) => ({ rect, level: 120 });

describe('textItemsFromContent', () => {
  // pdf.js viewport transform of an A4 page at scale 1
  const viewportTransform = [1, 0, 0, -1, 0, 842];

  it('converts PDF coordinates to top-left based page points', () => {
    const items = textItemsFromContent(
      [
        { str: 'Albert', transform: [8, 0, 0, 8, 40, 700], width: 24, height: 8 },
        { str: ' ', transform: [8, 0, 0, 8, 64, 700], width: 2, height: 8 },
        { type: 'beginMarkedContent' },
      ],
      viewportTransform,
    );

    expect(items).toEqual([
      { text: 'Albert', x: 40, y: 134, width: 24, height: 8 },
    ]);
  });

  it('skips rotated text', () => {
    const items = textItemsFromContent(
      [{ str: 'Margin note', transform: [0, 8, -8, 0, 20, 400], width: 40, height: 8 }],
      viewportTransform,
    );

    expect(items).toEqual([]);
  });
});

describe('measureArea', () => {
  it('measures dark, bright and inked pixels', () => {
    const page = pixels(100, 100, [black(0, 0, 50, 100)]);
    expect(measureArea(page, { x: 0, y: 0, width: 40, height: 40 }, 1)).toEqual(
      { dark: 1, bright: 0, ink: 1 },
    );
    expect(
      measureArea(page, { x: 60, y: 0, width: 40, height: 40 }, 1),
    ).toEqual({ dark: 0, bright: 1, ink: 0 });
  });

  it('scales page points to pixels', () => {
    const page = pixels(200, 200, [black(100, 100, 100, 100)]);
    expect(
      measureArea(page, { x: 50, y: 50, width: 50, height: 50 }, 2).dark,
    ).toBe(1);
  });
});

describe('removeHiddenText', () => {
  const run = (page: PagePixels, ...items: Array<[string, number, number]>) =>
    removeHiddenText(
      items.map(([text, x, width]) => ({ text, x, y: 10, width, height: 12 })),
      rect => measureArea(page, rect, 1),
    );

  it('drops text under black boxes and reports the boxes', () => {
    // Visible text has some ink in its box
    const page = pixels(200, 40, [gray(10, 12, 40, 8), black(100, 10, 60, 12)]);

    const result = run(page, ['Albert', 10, 40], ['1234', 100, 60]);

    expect(result.items.map(item => item.text)).toEqual(['Albert']);
    expect(result.redactions).toEqual([
      { x: 100, y: 10, width: 60, height: 12 },
    ]);
  });

  it('removes only the covered part of an item', () => {
    // "Účet 123456 Jan" with "123456" (characters 5–10) blacked out
    const page = pixels(200, 40, [
      gray(10, 12, 150, 8),
      black(10 + 5 * 10, 8, 6 * 10, 16),
    ]);

    const result = run(page, ['Účet 123456 Jan', 10, 150]);

    expect(result.items.map(item => [item.text, item.x])).toEqual([
      ['Účet ', 10],
      [' Jan', 120],
    ]);
    expect(result.redactions).toEqual([
      { x: 60, y: 10, width: 60, height: 12 },
    ]);
  });

  it('keeps light text on a dark header bar', () => {
    const page = pixels(200, 40, [{ rect: [0, 0, 200, 40], level: 40 }]);
    // Glyph strokes of white text inside the bar
    for (let x = 12; x < 60; x += 4) {
      for (let y = 12; y < 20; y++) {
        const i = (y * 200 + x) * 4;
        page.data[i] = page.data[i + 1] = page.data[i + 2] = 255;
      }
    }

    const result = run(page, ['Částka', 10, 50]);

    expect(result.items.map(item => item.text)).toEqual(['Částka']);
  });

  it('drops text covered with a white box', () => {
    const page = pixels(200, 40, []);

    const result = run(page, ['Secret', 10, 40]);

    expect(result.items).toEqual([]);
    expect(result.redactions).toHaveLength(1);
  });
});
