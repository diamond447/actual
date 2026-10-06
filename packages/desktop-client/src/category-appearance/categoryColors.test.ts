import { describe, expect, it } from 'vitest';

import {
  CATEGORY_COLOR_IDS,
  getCategoryColors,
  getContrastRatio,
  getRelativeLuminance,
} from './categoryColors';

describe('WCAG contrast utilities', () => {
  it('computes correct relative luminance for black and white', () => {
    expect(getRelativeLuminance('#000000')).toBe(0);
    expect(getRelativeLuminance('#FFFFFF')).toBeCloseTo(1, 4);
  });

  it('computes correct contrast ratio for black against white', () => {
    expect(getContrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
  });

  it('computes contrast ratio symmetrically', () => {
    const ratio1 = getContrastRatio('#2F7D32', '#E3F2E1');
    const ratio2 = getContrastRatio('#E3F2E1', '#2F7D32');
    expect(ratio1).toBe(ratio2);
  });
});

describe('Category colors contrast', () => {
  it('every dark mode color achieves at least 4.5:1 WCAG contrast against its own background', () => {
    for (const colorId of CATEGORY_COLOR_IDS) {
      const { fg, bg } = getCategoryColors(colorId, true);
      const contrast = getContrastRatio(fg, bg);
      expect(
        contrast,
        `Dark mode ${colorId} fg (${fg}) vs bg (${bg}) has contrast ${contrast.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('every light mode color achieves at least 4.5:1 WCAG contrast against its own background', () => {
    for (const colorId of CATEGORY_COLOR_IDS) {
      const { fg, bg } = getCategoryColors(colorId, false);
      const contrast = getContrastRatio(fg, bg);
      expect(
        contrast,
        `Light mode ${colorId} fg (${fg}) vs bg (${bg}) has contrast ${contrast.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('falls back to slate for unknown color id', () => {
    const colors = getCategoryColors('unknown-color');
    const slate = getCategoryColors('slate');
    expect(colors).toEqual(slate);
  });
});
