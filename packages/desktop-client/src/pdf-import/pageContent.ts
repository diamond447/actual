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

/** Share (0–1) of pixels in an area by how they look. */
export type AreaTone = {
  /** Near-black pixels, as under a redaction bar */
  dark: number;
  /** Light pixels, such as white text on a dark header bar */
  bright: number;
  /** Any pixels that are not (almost) white */
  ink: number;
};

/**
 * Convert pdf.js text content items to statement text items, using the
 * page viewport transform (at scale 1) to get top-left based coordinates.
 * Rotated text (e.g. margin notes) is skipped, as it is never part of the
 * transaction table.
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
    const [scaleX, skewY, skewX, scaleY, x, y] = item.transform;
    const isHorizontal =
      Math.abs(skewY) < 1e-3 && Math.abs(skewX) < 1e-3 && scaleX > 0;
    if (!isHorizontal) {
      continue;
    }
    const height = item.height || Math.abs(scaleY);
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
const BRIGHT_LUMINANCE = 160;
const INK_LUMINANCE = 225;

/**
 * Measure the pixels inside a rectangle given in page points. The
 * rectangle is shrunk slightly so neighbouring content does not count.
 */
export function measureArea(
  pixels: PagePixels,
  rect: StatementRect,
  scale: number,
): AreaTone {
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
  let bright = 0;
  let ink = 0;
  let total = 0;
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      const i = (y * pixels.width + x) * 4;
      const luminance =
        0.2126 * pixels.data[i] +
        0.7152 * pixels.data[i + 1] +
        0.0722 * pixels.data[i + 2];
      if (luminance < DARK_LUMINANCE) dark++;
      if (luminance > BRIGHT_LUMINANCE) bright++;
      if (luminance < INK_LUMINANCE) ink++;
      total++;
    }
  }
  return total === 0
    ? { dark: 0, bright: 1, ink: 1 }
    : { dark: dark / total, bright: bright / total, ink: ink / total };
}

/**
 * A character is covered when its area is solid black. Requiring almost no
 * light pixels keeps white text on dark header bars.
 */
function isCovered(tone: AreaTone) {
  return tone.dark >= 0.9 && tone.bright < 0.02;
}

/**
 * Remove text the user hid. Covering text with a black box (or a white
 * one) usually leaves the text in the PDF, so without this step the hidden
 * details would still be imported. Each item is checked character by
 * character, so a box over part of an item (an account number inside a
 * longer description) removes just that part.
 */
export function removeHiddenText(
  items: StatementTextItem[],
  measure: (rect: StatementRect) => AreaTone,
): { items: StatementTextItem[]; redactions: StatementRect[] } {
  const kept: StatementTextItem[] = [];
  const redactions: StatementRect[] = [];

  for (const item of items) {
    const box = {
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
    };

    // Text without any ink is covered by a white box or invisible
    if (measure(box).ink < 0.005) {
      redactions.push(box);
      continue;
    }

    const characters = Array.from(item.text);
    const charWidth = item.width / characters.length;
    const covered = characters.map(
      (character, index) =>
        character.trim() !== '' &&
        isCovered(
          measure({ ...box, x: item.x + index * charWidth, width: charWidth }),
        ),
    );
    if (!covered.some(Boolean)) {
      kept.push(item);
      continue;
    }

    // Spaces between covered characters belong to the covered run
    const isSpace = (index: number) => characters[index].trim() === '';
    for (let index = 0; index < characters.length; index++) {
      if (!isSpace(index)) continue;
      let before = index - 1;
      while (before >= 0 && isSpace(before)) before--;
      let after = index + 1;
      while (after < characters.length && isSpace(after)) after++;
      covered[index] =
        before >= 0 &&
        after < characters.length &&
        covered[before] &&
        covered[after];
    }

    let start = 0;
    while (start < characters.length) {
      let end = start;
      while (end < characters.length && covered[end] === covered[start]) {
        end++;
      }
      const rect = {
        x: item.x + start * charWidth,
        y: item.y,
        width: (end - start) * charWidth,
        height: item.height,
      };
      if (covered[start]) {
        redactions.push(rect);
      } else {
        const text = characters.slice(start, end).join('');
        if (text.trim() !== '') {
          kept.push({ ...item, ...rect, text });
        }
      }
      start = end;
    }
  }
  return { items: kept, redactions };
}
