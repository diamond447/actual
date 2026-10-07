import { Trans } from 'react-i18next';

import { SvgCheckmark } from '@actual-app/components/icons/v1';
import { theme } from '@actual-app/components/theme';

import type { OnboardingLanguage } from './currencyHelper';

type StepLanguageProps = {
  selectedLanguage: OnboardingLanguage;
  onSelectLanguage: (language: OnboardingLanguage) => void;
};

const LANGUAGES: readonly {
  code: OnboardingLanguage;
  label: string;
  sublabel: string;
}[] = [
  { code: 'cs', label: 'Čeština', sublabel: 'Czech' },
  { code: 'en', label: 'English', sublabel: 'English' },
];

export function StepLanguage({
  selectedLanguage,
  onSelectLanguage,
}: StepLanguageProps) {
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
        <Trans>Welcome!</Trans>
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
        <Trans>Let's set up your budget. It takes a minute.</Trans>
      </p>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {LANGUAGES.map(lang => {
          const isSelected = selectedLanguage === lang.code;
          return (
            <button
              key={lang.code}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelectLanguage(lang.code)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span
                  style={{
                    fontSize: 17,
                    fontWeight: 700,
                    color: theme.pageText,
                  }}
                >
                  {lang.label}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    color: theme.pageTextSubdued,
                  }}
                >
                  {lang.sublabel}
                </span>
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
