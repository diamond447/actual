import type { StatementRect, StatementTextItem } from './types';

/** The subset of a pdf.js text content item that we use. */
export type PdfTextContentItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
};

/** Pixel data of a rendered page, like the browser's ImageData. */
export type PagePixels = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

/**
 * Convert pdf.js text content items to statement text items, using the
 * page viewport transform (at scale 1) to get top-left based coordinates.
 */
export function textItemsFromContent(
  items: Array<PdfTextContentItem | { type: string }>,
  viewportTransform: number[],
): StatementTextItem[] {
  const [a, b, c, d, e, f] = viewportTransform;
  const result: StatementTextItem[] = [];
  for (const item of items) {
    if (!('str' in item) || item.str.trim() === '') {
      continue;
    }
    const [, , , , x, y] = item.transform;
    const height = item.height || Math.hypot(item.transform[2], item.transform[3]);
    const viewportX = a * x + c * y + e;
    const viewportY = b * x + d * y + f;
    result.push({
      text: item.str,
      x: viewportX,
      y: viewportY - height,
      width: item.width,
      height,
    });
  }
  return result;
}

const DARK_LUMINANCE = 80;

/**
 * Fraction (0–1) of dark pixels inside a rectangle given in page points.
 * The rectangle is shrunk slightly so neighbouring content does not count.
 */
export function darknessOf(
  pixels: PagePixels,
  rect: StatementRect,
  scale: number,
): number {
  const insetX = rect.width * 0.1;
  const insetY = rect.height * 0.15;
  const left = Math.max(0, Math.floor((rect.x + insetX) * scale));
  const right = Math.min(
    pixels.width,
    Math.ceil((rect.x + rect.width - insetX) * scale),
  );
  const top = Math.max(0, Math.floor((rect.y + insetY) * scale));
  const bottom = Math.min(
    pixels.height,
    Math.ceil((rect.y + rect.height - insetY) * scale),
  );

  let dark = 0;
  let total = 0;
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      const i = (y * pixels.width + x) * 4;
      const luminance =
        0.2126 * pixels.data[i] +
        0.7152 * pixels.data[i + 1] +
        0.0722 * pixels.data[i + 2];
      if (luminance < DARK_LUMINANCE) {
        dark++;
      }
      total++;
    }
  }
  return total === 0 ? 0 : dark / total;
}

/** Regular text covers far less of its box than a redaction bar does. */
const REDACTED_DARKNESS = 0.7;

/**
 * Drop text that is hidden under a blacked-out area. Covering text with a
 * black box usually leaves the text in the PDF, so without this step the
 * hidden details would still be imported.
 */
export function removeRedactedItems(
  items: StatementTextItem[],
  darkness: (rect: StatementRect) => number,
): { items: StatementTextItem[]; redactions: StatementRect[] } {
  const kept: StatementTextItem[] = [];
  const redactions: StatementRect[] = [];
  for (const item of items) {
    if (darkness(item) >= REDACTED_DARKNESS) {
      redactions.push({
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
      });
    } else {
      kept.push(item);
    }
  }
  return { items: kept, redactions };
}
