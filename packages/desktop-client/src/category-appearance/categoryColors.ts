export const CATEGORY_COLOR_IDS = [
  'green',
  'blue',
  'amber',
  'orange',
  'pink',
  'purple',
  'olive',
  'slate',
  'teal',
  'red',
] as const;

export type CategoryColorId = (typeof CATEGORY_COLOR_IDS)[number];

export function isValidColorId(id: string): id is CategoryColorId {
  return (CATEGORY_COLOR_IDS as readonly string[]).includes(id);
}

type ColorPair = {
  fg: string;
  bg: string;
};

const CATEGORY_COLORS: Record<
  CategoryColorId,
  { light: ColorPair; dark: ColorPair }
> = {
  green: {
    light: { fg: '#2E7B31', bg: '#E3F2E1' },
    dark: { fg: '#52C463', bg: '#1B2A1E' },
  },
  blue: {
    light: { fg: '#1D5FA8', bg: '#E2ECF8' },
    dark: { fg: '#5B9CF6', bg: '#182436' },
  },
  amber: {
    light: { fg: '#986100', bg: '#FBEFD9' },
    dark: { fg: '#F5A623', bg: '#332510' },
  },
  orange: {
    light: { fg: '#B5470D', bg: '#FCE6DA' },
    dark: { fg: '#FA7A35', bg: '#351F14' },
  },
  pink: {
    light: { fg: '#B4234B', bg: '#FBE4EA' },
    dark: { fg: '#F45B88', bg: '#361823' },
  },
  purple: {
    light: { fg: '#5B3DB5', bg: '#ECE6FA' },
    dark: { fg: '#A78BFA', bg: '#271C3D' },
  },
  olive: {
    light: { fg: '#6E6300', bg: '#F4F1D2' },
    dark: { fg: '#D4C936', bg: '#2C2A14' },
  },
  slate: {
    light: { fg: '#454B57', bg: '#E8EAEE' },
    dark: { fg: '#9CA3AF', bg: '#22252A' },
  },
  teal: {
    light: { fg: '#0E7863', bg: '#DDF1EA' },
    dark: { fg: '#38B2AC', bg: '#142926' },
  },
  red: {
    light: { fg: '#B42318', bg: '#FEE4E2' },
    dark: { fg: '#F87171', bg: '#361919' },
  },
};

export function getCategoryColors(
  color: CategoryColorId | string,
  isDark = false,
): ColorPair {
  const colorId = isValidColorId(color) ? color : 'slate';
  const mode = isDark ? 'dark' : 'light';
  return CATEGORY_COLORS[colorId][mode];
}

/**
 * Parses a hex string (#RGB, #RRGGBB) to [r, g, b] in [0, 255].
 */
export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace(/^#/, '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r, g, b];
  }
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/**
 * Calculates WCAG 2.1 relative luminance for a hex color.
 */
export function getRelativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  const toLinear = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Calculates WCAG 2.1 contrast ratio between two colors.
 */
export function getContrastRatio(color1: string, color2: string): number {
  const l1 = getRelativeLuminance(color1);
  const l2 = getRelativeLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
