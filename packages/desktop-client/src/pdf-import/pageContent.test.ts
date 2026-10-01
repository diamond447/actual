import {
  darknessOf,
  removeRedactedItems,
  textItemsFromContent,
} from './pageContent';
import type { PagePixels } from './pageContent';

/** A white page (in pixels) with black rectangles drawn on it. */
function pixels(
  width: number,
  height: number,
  blackRects: Array<[number, number, number, number]>,
): PagePixels {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (const [left, top, rectWidth, rectHeight] of blackRects) {
    for (let y = top; y < top + rectHeight; y++) {
      for (let x = left; x < left + rectWidth; x++) {
        const i = (y * width + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = 0;
      }
    }
  }
  return { width, height, data };
}

describe('textItemsFromContent', () => {
  it('converts PDF coordinates to top-left based page points', () => {
    // pdf.js viewport transform of an A4 page at scale 1
    const viewportTransform = [1, 0, 0, -1, 0, 842];
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
});

describe('darknessOf', () => {
  it('measures the dark part of an area', () => {
    const page = pixels(100, 100, [[0, 0, 50, 100]]);
    expect(darknessOf(page, { x: 0, y: 0, width: 40, height: 40 }, 1)).toBe(1);
    expect(darknessOf(page, { x: 60, y: 0, width: 40, height: 40 }, 1)).toBe(
      0,
    );
    expect(
      darknessOf(page, { x: 30, y: 0, width: 40, height: 40 }, 1),
    ).toBeCloseTo(0.5, 1);
  });

  it('scales page points to pixels', () => {
    const page = pixels(200, 200, [[100, 100, 100, 100]]);
    expect(darknessOf(page, { x: 50, y: 50, width: 50, height: 50 }, 2)).toBe(
      1,
    );
  });
});

describe('removeRedactedItems', () => {
  it('drops text under black boxes and reports the boxes', () => {
    const page = pixels(200, 100, [[100, 10, 60, 12]]);
    const visible = { text: 'Albert', x: 10, y: 10, width: 40, height: 12 };
    const hidden = { text: '1234', x: 100, y: 10, width: 60, height: 12 };

    const result = removeRedactedItems([visible, hidden], rect =>
      darknessOf(page, rect, 1),
    );

    expect(result.items).toEqual([visible]);
    expect(result.redactions).toEqual([
      { x: 100, y: 10, width: 60, height: 12 },
    ]);
  });
});
