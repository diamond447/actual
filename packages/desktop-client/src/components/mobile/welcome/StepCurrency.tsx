import { Trans, useTranslation } from 'react-i18next';

import { SvgCheckmark } from '@actual-app/components/icons/v1';
import { theme } from '@actual-app/components/theme';

import type { OnboardingCurrency } from './currencyHelper';

type StepCurrencyProps = {
  selectedCurrency: OnboardingCurrency;
  onSelectCurrency: (currency: OnboardingCurrency) => void;
};

export function StepCurrency({
  selectedCurrency,
  onSelectCurrency,
}: StepCurrencyProps) {
  const { t } = useTranslation();

  const currencies: readonly {
    code: OnboardingCurrency;
    symbol: string;
    label: string;
  }[] = [
    { code: 'CZK', symbol: 'Kč', label: t('Czech Koruna') },
    { code: 'EUR', symbol: '€', label: t('Euro') },
    { code: 'USD', symbol: '$', label: t('US Dollar') },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
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
        }}
      >
        <Trans>Currency</Trans>
      </h1>

      <p
        style={{
          fontSize: 14,
          color: theme.pageTextSubdued,
          margin: 0,
          marginBottom: 24,
          lineHeight: 1.4,
        }}
      >
        <Trans>
          Choose your primary currency for accounts and transactions.
        </Trans>
      </p>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {currencies.map(curr => {
          const isSelected = selectedCurrency === curr.code;
          return (
            <button
              key={curr.code}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelectCurrency(curr.code)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                borderRadius: 20,
                backgroundColor: theme.tableBackground,
                border: isSelected
                  ? `2px solid ${theme.buttonPrimaryBackground}`
                  : `1px solid ${theme.tableBorder}`,
                cursor: 'pointer',
                textAlign: 'left',
                minHeight: 70,
                outline: 'none',
                transition:
                  'border-color 0.15s ease, background-color 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 14,
                    backgroundColor: isSelected
                      ? theme.buttonPrimaryBackground
                      : theme.mobilePageBackground,
                    color: isSelected
                      ? theme.buttonPrimaryText
                      : theme.pageText,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    fontWeight: 700,
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {curr.symbol}
                </div>

                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
                >
                  <span
                    style={{
                      fontSize: 17,
                      fontWeight: 700,
                      color: theme.pageText,
                    }}
                  >
                    {curr.code}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      color: theme.pageTextSubdued,
                    }}
                  >
                    {curr.label}
                  </span>
                </div>
              </div>

              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isSelected
                    ? theme.buttonPrimaryBackground
                    : 'transparent',
                  border: isSelected
                    ? 'none'
                    : `2px solid ${theme.tableBorder}`,
                  color: theme.buttonPrimaryText,
                  flexShrink: 0,
                }}
              >
                {isSelected && <SvgCheckmark width={14} height={14} />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
