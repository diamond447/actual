import { Trans, useTranslation } from 'react-i18next';

import { theme } from '@actual-app/components/theme';

type StepAccountProps = {
  accountName: string;
  onAccountNameChange: (name: string) => void;
  balanceStr: string;
  onBalanceChange: (balance: string) => void;
  currencySymbol: string;
};

export function StepAccount({
  accountName,
  onAccountNameChange,
  balanceStr,
  onBalanceChange,
  currencySymbol,
}: StepAccountProps) {
  const { t } = useTranslation();

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
        <Trans>Your account</Trans>
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
        <Trans>Where do you keep your money?</Trans>
      </p>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        {/* Account name field */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label
            htmlFor="welcome-account-name"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: theme.pageTextSubdued,
            }}
          >
            <Trans>Account name</Trans>
          </label>
          <input
            id="welcome-account-name"
            type="text"
            value={accountName}
            onChange={e => onAccountNameChange(e.target.value)}
            placeholder={t('Checking account')}
            style={{
              height: 50,
              borderRadius: 14,
              border: `1px solid ${theme.tableBorder}`,
              backgroundColor: theme.tableBackground,
              color: theme.pageText,
              padding: '0 16px',
              fontSize: 16,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Current balance field */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label
            htmlFor="welcome-account-balance"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: theme.pageTextSubdued,
            }}
          >
            <Trans>Current balance</Trans>
          </label>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              height: 50,
              borderRadius: 14,
              border: `1px solid ${theme.tableBorder}`,
              backgroundColor: theme.tableBackground,
              padding: '0 16px',
              boxSizing: 'border-box',
            }}
          >
            <input
              id="welcome-account-balance"
              type="text"
              inputMode="decimal"
              value={balanceStr}
              onChange={e => onBalanceChange(e.target.value)}
              placeholder="0"
              style={{
                flex: 1,
                border: 'none',
                backgroundColor: 'transparent',
                color: theme.pageText,
                fontSize: 18,
                fontWeight: 600,
                outline: 'none',
                minWidth: 0,
              }}
            />
            {currencySymbol && (
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: theme.pageTextSubdued,
                  marginLeft: 8,
                  userSelect: 'none',
                }}
              >
                {currencySymbol}
              </span>
            )}
          </div>
          <span
            style={{
              fontSize: 12,
              color: theme.pageTextSubdued,
            }}
          >
            <Trans>Starting balance may be 0, positive, or negative.</Trans>
          </span>
        </div>
      </div>
    </div>
  );
}
