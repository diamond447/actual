import type { CSSProperties } from 'react';

import { CategoryIcon } from './icons';
import { useCategoryAppearance } from './useCategoryAppearance';

export type CategoryBadgeProps = {
  category: { id: string; name: string };
  size?: number;
  className?: string;
  style?: CSSProperties;
};

export function CategoryBadge({
  category,
  size = 40,
  className,
  style,
}: CategoryBadgeProps) {
  const { icon, colors } = useCategoryAppearance(category);
  const borderRadius = Math.round((size / 40) * 13);
  const iconSize = Math.max(12, Math.round(size * 0.55));

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        borderRadius,
        backgroundColor: colors.bg,
        color: colors.fg,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <CategoryIcon icon={icon} size={iconSize} />
    </div>
  );
}
