import type { CSSProperties } from 'react';

export const CATEGORY_ICON_IDS = [
  'cart',
  'restaurant',
  'coffee',
  'home',
  'repair',
  'bolt',
  'water',
  'bus',
  'car',
  'fuel',
  'plane',
  'heart',
  'pill',
  'sport',
  'beauty',
  'ticket',
  'game',
  'music',
  'film',
  'shirt',
  'gift',
  'book',
  'kids',
  'pet',
  'phone',
  'wifi',
  'receipt',
  'shield',
  'piggy',
  'wallet',
  'salary',
  'cash',
  'tag',
] as const;

export type CategoryIconId = (typeof CATEGORY_ICON_IDS)[number];

export function isValidIconId(id: string): id is CategoryIconId {
  return (CATEGORY_ICON_IDS as readonly string[]).includes(id);
}

const ICON_PATHS: Record<CategoryIconId, string> = {
  cart: 'M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2 M9 21h.01 M18 21h.01',
  restaurant:
    'M7 3v8 M4 3v5a3 3 0 0 0 6 0V3 M7 11v10 M17 21V3c-2 0-3.5 2.5-3.5 6s1.5 4 3.5 4',
  coffee:
    'M18 8h1a4 4 0 0 1 0 8h-1 M2 8h16v7a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z M6 1v3 M10 1v3 M14 1v3',
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  repair:
    'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z',
  bolt: 'M13 3L5 14h6l-1 7 8-11h-6z',
  water: 'M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z',
  bus: 'M5 17h14v-5l-2-5H7l-2 5z M5 12h14 M7.5 17v2 M16.5 17v2',
  car: 'M3 14l2-6h14l2 6v5a1 1 0 0 1-1 1h-1a2 2 0 0 1-4 0H9a2 2 0 0 1-4 0H4a1 1 0 0 1-1-1v-5z M5 14h14 M7 11h10',
  fuel: 'M3 22h12 M4 4h10a1 1 0 0 1 1 1v17H3V5a1 1 0 0 1 1-1z M4 9h10 M15 9l3 3v6a2 2 0 0 0 4 0v-7l-2-2',
  plane:
    'M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  pill: 'M10.5 20.5l-6-6a5 5 0 0 1 7-7l6 6a5 5 0 0 1-7 7z M8.5 8.5l7 7',
  sport: 'M6.5 6.5l11 11 M4 10l6-6 M2 8l6-6 M14 20l6-6 M16 22l6-6',
  beauty: 'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z',
  ticket: 'M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z M10 7v10',
  game: 'M6 11h4 M8 9v4 M15 12h.01 M18 10h.01 M6 6h12a4 4 0 0 1 4 4v5a3 3 0 0 1-5 2.2L15 15H9l-2 2.2A3 3 0 0 1 2 15v-5a4 4 0 0 1 4-4z',
  music:
    'M9 18V5l12-2v13 M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0z M21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  film: 'M2 4h20v16H2z M2 8h20 M2 16h20 M6 4v4 M6 16v4 M18 4v4 M18 16v4 M12 4v4 M12 16v4',
  shirt: 'M8 4l4 2 4-2 4 3-2 3-2-1v11H8V9l-2 1-2-3z',
  gift: 'M20 12v10H4V12 M2 7h20v5H2z M12 22V7 M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z',
  book: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z',
  kids: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M8 13a4 4 0 0 0 8 0 M9 9h.01 M15 9h.01',
  pet: 'M12 13a3 3 0 0 1 3 3c0 2-1.5 3-3 3s-3-1-3-3a3 3 0 0 1 3-3z M6 10a2 2 0 1 1 0-4 2 2 0 0 1 0 4z M18 10a2 2 0 1 1 0-4 2 2 0 0 1 0 4z M9 6a2 2 0 1 1 0-4 2 2 0 0 1 0 4z M15 6a2 2 0 1 1 0-4 2 2 0 0 1 0 4z',
  phone:
    'M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z M12 18h.01',
  wifi: 'M2 8.82a15 15 0 0 1 20 0 M5 12.86a10 10 0 0 1 14 0 M8.5 16.9a5 5 0 0 1 7 0 M12 20h.01',
  receipt:
    'M4 2v20l3-2 3 2 3-2 3 2 4-2V2l-4 2-3-2-3 2-3-2-3 2z M8 7h8 M8 11h8 M8 15h5',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  piggy:
    'M19 11c0-3.87-3.13-7-7-7-1.5 0-2.88.47-4.02 1.28L4 5v3.12C3.38 9.25 3 10.58 3 12c0 3.31 2.31 6.08 5.43 6.84L7 21h3l1.5-2.02c.16.01.33.02.5.02 1.34 0 2.58-.37 3.64-1.02L17 21h3l-1.32-3.3C20.34 16.15 21 14.19 21 12v-1z M16 4h-4 M2 12h2',
  wallet:
    'M4 7h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4z M4 7V6a2 2 0 0 1 2-2h10 M16 13h.01',
  salary:
    'M4 7h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2 M2 12h20 M10 15h4',
  cash: 'M2 6h20v12H2z M6 12h.01 M18 12h.01 M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  tag: 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z M7 7h.01',
};

export type CategoryIconProps = {
  icon: CategoryIconId | string;
  size?: number;
  className?: string;
  style?: CSSProperties;
};

export function CategoryIcon({
  icon,
  size = 20,
  className,
  style,
}: CategoryIconProps) {
  const d =
    isValidIconId(icon) && icon in ICON_PATHS
      ? ICON_PATHS[icon]
      : ICON_PATHS.tag;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={style}
    >
      <path d={d} />
    </svg>
  );
}
