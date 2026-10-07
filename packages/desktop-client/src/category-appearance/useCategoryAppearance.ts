import { useEffect, useState } from 'react';

import { useSyncedPref } from '#hooks/useSyncedPref';
import { useTheme } from '#style/theme';

import { getCategoryColors, isValidColorId } from './categoryColors';
import type { CategoryColorId } from './categoryColors';
import { guessCategoryAppearance } from './guess';
import { isValidIconId } from './icons';
import type { CategoryIconId } from './icons';

export type CategoryAppearance = {
  icon: CategoryIconId;
  color: CategoryColorId;
  colors: { fg: string; bg: string };
  setAppearance: (next: {
    icon: CategoryIconId;
    color: CategoryColorId;
  }) => void;
};

export function parseCategoryAppearance(
  raw: string | null | undefined,
  name: string,
  id: string,
): { icon: CategoryIconId; color: CategoryColorId } {
  const guessed = guessCategoryAppearance(name, id);
  if (!raw || typeof raw !== 'string') {
    return guessed;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return guessed;
    }

    const icon =
      typeof parsed.icon === 'string' && isValidIconId(parsed.icon)
        ? parsed.icon
        : guessed.icon;
    const color =
      typeof parsed.color === 'string' && isValidColorId(parsed.color)
        ? parsed.color
        : guessed.color;

    return { icon, color };
  } catch {
    return guessed;
  }
}

export function useIsDark(): boolean {
  const [theme] = useTheme();
  const [matchesDark, setMatchesDark] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => {
      setMatchesDark(e.matches);
    };
    mediaQuery.addEventListener('change', onChange);
    setMatchesDark(mediaQuery.matches);
    return () => {
      mediaQuery.removeEventListener('change', onChange);
    };
  }, []);

  if (theme === 'dark' || theme === 'midnight') {
    return true;
  }
  if (theme === 'light') {
    return false;
  }
  return matchesDark;
}

export function useCategoryAppearance(category: {
  id: string;
  name: string;
}): CategoryAppearance {
  const prefKey = `category-appearance-${category.id}` as const;
  const [prefValue, setPrefValue] = useSyncedPref(prefKey);
  const isDark = useIsDark();

  const { icon, color } = parseCategoryAppearance(
    prefValue,
    category.name,
    category.id,
  );

  const colors = getCategoryColors(color, isDark);

  const setAppearance = (next: {
    icon: CategoryIconId;
    color: CategoryColorId;
  }) => {
    setPrefValue(JSON.stringify({ icon: next.icon, color: next.color }));
  };

  return {
    icon,
    color,
    colors,
    setAppearance,
  };
}
