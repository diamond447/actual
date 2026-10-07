import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { theme } from '@actual-app/components/theme';

type WelcomeStepIndicatorProps = {
  currentStep: number;
  onBack: () => void;
  onSkip: () => void;
  isSaving?: boolean;
};

export function WelcomeStepIndicator({
  currentStep,
  onBack,
  onSkip,
  isSaving = false,
}: WelcomeStepIndicatorProps) {
  const { t } = useTranslation();
  const dots = [1, 2, 3, 4];
  const showBack = currentStep >= 2 && currentStep <= 4;
  const showSkip = currentStep <= 4;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 44,
        flexShrink: 0,
        marginBottom: 12,
        userSelect: 'none',
      }}
    >
      <div
        style={{ minWidth: 64, display: 'flex', justifyContent: 'flex-start' }}
      >
        {showBack ? (
          <Button
            variant="bare"
            isDisabled={isSaving}
            onPress={onBack}
            aria-label={t('Back')}
            style={{
              padding: '8px 4px',
              fontSize: 15,
              fontWeight: 600,
              color: theme.pageText,
              cursor: isSaving ? 'default' : 'pointer',
              minHeight: 44,
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            <Trans>Back</Trans>
          </Button>
        ) : (
          <div style={{ width: 64, height: 44 }} />
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
        aria-label={t('Step {{current}} of 4', {
          current: Math.min(currentStep, 4),
        })}
      >
        {dots.map(dot => {
          const isActive = dot === currentStep;
          const isCompleted = dot < currentStep;
          return (
            <div
              key={dot}
              style={{
                width: isActive ? 20 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor:
                  isActive || isCompleted
                    ? theme.buttonPrimaryBackground
                    : theme.tableBorder,
                opacity: isCompleted && !isActive ? 0.6 : 1,
                transition: 'all 0.25s ease',
              }}
            />
          );
        })}
      </div>

      <div
        style={{ minWidth: 64, display: 'flex', justifyContent: 'flex-end' }}
      >
        {showSkip ? (
          <Button
            variant="bare"
            isDisabled={isSaving}
            onPress={onSkip}
            aria-label={t('Skip')}
            style={{
              padding: '8px 4px',
              fontSize: 15,
              fontWeight: 600,
              color: theme.pageTextSubdued,
              cursor: isSaving ? 'default' : 'pointer',
              minHeight: 44,
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            <Trans>Skip</Trans>
          </Button>
        ) : (
          <div style={{ width: 64, height: 44 }} />
        )}
      </div>
    </div>
  );
}
