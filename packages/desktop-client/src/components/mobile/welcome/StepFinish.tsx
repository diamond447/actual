import { Trans } from 'react-i18next';

import { SvgCheckmark } from '@actual-app/components/icons/v1';
import { theme } from '@actual-app/components/theme';

export function StepFinish() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        textAlign: 'center',
        padding: '20px 10px',
      }}
    >
      {/* Checkmark badge */}
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: theme.buttonPrimaryBackground,
          color: theme.buttonPrimaryText,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
        }}
      >
        <SvgCheckmark width={36} height={36} />
      </div>

      <h1
        style={{
          fontSize: 28,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: theme.pageText,
          margin: 0,
          marginBottom: 10,
        }}
      >
        <Trans>You're all set!</Trans>
      </h1>

      <p
        style={{
          fontSize: 15,
          color: theme.pageTextSubdued,
          margin: 0,
          lineHeight: 1.5,
          maxWidth: 260,
        }}
      >
        <Trans>Tap + to log a payment in two taps.</Trans>
      </p>
    </div>
  );
}
