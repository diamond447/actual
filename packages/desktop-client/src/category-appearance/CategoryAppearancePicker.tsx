import type { ReactNode } from 'react';
import {
  Dialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
} from 'react-aria-components';
import { Trans, useTranslation } from 'react-i18next';

import { styles } from '@actual-app/components/styles';
import { theme } from '@actual-app/components/theme';
import { css } from '@emotion/css';

import { CATEGORY_COLOR_IDS, getCategoryColors } from './categoryColors';
import { CATEGORY_ICON_IDS, CategoryIcon } from './icons';
import { useCategoryAppearanceLabels } from './labels';
import { useCategoryAppearance, useIsDark } from './useCategoryAppearance';

export type CategoryAppearancePickerProps = {
  category: { id: string; name: string };
  children?: ReactNode;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
};

export function CategoryAppearancePicker({
  category,
  children,
  isOpen,
  onOpenChange,
}: CategoryAppearancePickerProps) {
  const { t } = useTranslation();
  const { icon, color, colors, setAppearance } =
    useCategoryAppearance(category);
  const isDark = useIsDark();
  const { colorLabels, iconLabels } = useCategoryAppearanceLabels();

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={onOpenChange}>
      {children}
      <ModalOverlay isDismissable className={overlayClass}>
        <Modal className={sheetClass}>
          <Dialog
            aria-label={t('Category appearance')}
            style={{
              outline: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {({ close }) => (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Heading
                    level={2}
                    style={{
                      margin: 0,
                      fontSize: 18,
                      fontWeight: 700,
                      color: theme.pageText,
                    }}
                  >
                    <Trans>Category appearance</Trans>
                  </Heading>
                  <button
                    type="button"
                    onClick={close}
                    style={{
                      minWidth: 44,
                      minHeight: 44,
                      padding: '8px 12px',
                      background: 'transparent',
                      border: 'none',
                      color: theme.mobileNavItemSelected,
                      fontSize: 15,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Trans>Done</Trans>
                  </button>
                </div>

                {/* Live Preview */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '12px 16px',
                    borderRadius: 16,
                    backgroundColor: theme.tableBackground,
                    border: `1px solid ${theme.tableBorder}`,
                  }}
                >
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      minWidth: 52,
                      minHeight: 52,
                      borderRadius: 17,
                      backgroundColor: colors.bg,
                      color: colors.fg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <CategoryIcon icon={icon} size={28} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: 17,
                        fontWeight: 600,
                        color: theme.pageText,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {category.name}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: theme.pageTextSubdued,
                        marginTop: 2,
                      }}
                    >
                      <Trans>Preview</Trans>
                    </div>
                  </div>
                </div>

                {/* Color swatches */}
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: theme.pageTextSubdued,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginBottom: 8,
                    }}
                  >
                    <Trans>Color</Trans>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      overflowX: 'auto',
                      paddingBottom: 4,
                      WebkitOverflowScrolling: 'touch',
                    }}
                  >
                    {CATEGORY_COLOR_IDS.map(colorId => {
                      const isSelected = color === colorId;
                      const swatches = getCategoryColors(colorId, isDark);
                      return (
                        <button
                          key={colorId}
                          type="button"
                          aria-label={colorLabels[colorId]}
                          aria-pressed={isSelected}
                          onClick={() =>
                            setAppearance({ icon, color: colorId })
                          }
                          className={buttonResetClass}
                          style={{
                            width: 44,
                            height: 44,
                            minWidth: 44,
                            minHeight: 44,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            flexShrink: 0,
                            boxShadow: isSelected
                              ? `0 0 0 2px ${theme.mobilePageBackground}, 0 0 0 4px ${theme.mobileNavItemSelected}`
                              : undefined,
                          }}
                        >
                          <span
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              backgroundColor: swatches.fg,
                              border: `2px solid ${swatches.bg}`,
                              boxSizing: 'border-box',
                              display: 'block',
                            }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Icon grid */}
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: theme.pageTextSubdued,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginBottom: 8,
                    }}
                  >
                    <Trans>Icon</Trans>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fill, minmax(44px, 1fr))',
                      gap: 8,
                      maxHeight: 220,
                      overflowY: 'auto',
                      padding: 2,
                    }}
                  >
                    {CATEGORY_ICON_IDS.map(iconId => {
                      const isSelected = icon === iconId;
                      return (
                        <button
                          key={iconId}
                          type="button"
                          aria-label={iconLabels[iconId]}
                          aria-pressed={isSelected}
                          onClick={() => setAppearance({ icon: iconId, color })}
                          className={buttonResetClass}
                          style={{
                            height: 44,
                            minWidth: 44,
                            minHeight: 44,
                            borderRadius: 12,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: isSelected
                              ? `2px solid ${theme.mobileNavItemSelected}`
                              : `1px solid ${theme.tableBorder}`,
                            backgroundColor: isSelected
                              ? colors.bg
                              : theme.tableBackground,
                            color: isSelected ? colors.fg : theme.pageText,
                            cursor: 'pointer',
                            padding: 0,
                            boxSizing: 'border-box',
                          }}
                        >
                          <CategoryIcon icon={iconId} size={22} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}

const overlayClass = css({
  position: 'fixed',
  inset: 0,
  zIndex: 3000,
  backgroundColor: theme.overlayBackground,
  display: 'flex',
  alignItems: 'flex-end',
});

const sheetClass = css({
  width: '100%',
  maxHeight: '90vh',
  boxSizing: 'border-box',
  padding: '20px 16px calc(20px + env(safe-area-inset-bottom))',
  borderRadius: '24px 24px 0 0',
  backgroundColor: theme.mobilePageBackground,
  outline: 'none',
  overflowY: 'auto',
});

const buttonResetClass = css({
  ...styles.noTapHighlight,
  fontFamily: 'inherit',
  border: 'none',
  background: 'transparent',
  padding: 0,
  '&:focus-visible': {
    outline: `2px solid ${theme.mobileNavItemSelected}`,
    outlineOffset: 2,
  },
});
