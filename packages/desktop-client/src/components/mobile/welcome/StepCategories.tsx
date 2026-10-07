import { Trans, useTranslation } from 'react-i18next';

import { SvgCheckmark } from '@actual-app/components/icons/v1';
import { theme } from '@actual-app/components/theme';

import {
  CategoryIcon,
  getCategoryColors,
  useIsDark,
} from '#category-appearance';

import { PRESET_EXPENSE_CATEGORIES } from './categoriesPreset';

type StepCategoriesProps = {
  selectedCategoryIds: Set<string>;
  onToggleCategory: (id: string) => void;
};

export function StepCategories({
  selectedCategoryIds,
  onToggleCategory,
}: StepCategoriesProps) {
  const { t } = useTranslation();
  const isDark = useIsDark();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
      }}
    >
      <h1
        style={{
          fontSize: 26,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: theme.pageText,
          margin: 0,
          marginBottom: 8,
          flexShrink: 0,
        }}
      >
        <Trans>Categories</Trans>
      </h1>

      <p
        style={{
          fontSize: 14,
          color: theme.pageTextSubdued,
          margin: 0,
          marginBottom: 16,
          lineHeight: 1.4,
          flexShrink: 0,
        }}
      >
        <Trans>What do you spend money on?</Trans>
      </p>

      {/* Scrollable category cards grid */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 4,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 8,
          }}
        >
          {PRESET_EXPENSE_CATEGORIES.map(cat => {
            const isSelected = selectedCategoryIds.has(cat.id);
            const colors = getCategoryColors(cat.color, isDark);

            return (
              <button
                key={cat.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onToggleCategory(cat.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 10px',
                  borderRadius: 16,
                  backgroundColor: theme.tableBackground,
                  border: isSelected
                    ? `2px solid ${theme.buttonPrimaryBackground}`
                    : `1px solid ${theme.tableBorder}`,
                  cursor: 'pointer',
                  textAlign: 'left',
                  minHeight: 52,
                  outline: 'none',
                  boxSizing: 'border-box',
                  gap: 8,
                  transition: 'border-color 0.15s ease',
                }}
              >
                {/* Category Icon Badge */}
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    backgroundColor: colors.bg,
                    color: colors.fg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <CategoryIcon icon={cat.icon} size={18} />
                </div>

                {/* Name */}
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: theme.pageText,
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t(cat.name)}
                </span>

                {/* Selection Checkmark */}
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isSelected
                      ? theme.buttonPrimaryBackground
                      : 'transparent',
                    border: isSelected
                      ? 'none'
                      : `1.5px solid ${theme.tableBorder}`,
                    color: theme.buttonPrimaryText,
                    flexShrink: 0,
                  }}
                >
                  {isSelected && <SvgCheckmark width={11} height={11} />}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
