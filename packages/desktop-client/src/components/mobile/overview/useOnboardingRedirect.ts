import { useEffect } from 'react';

import { useResponsive } from '@actual-app/components/hooks/useResponsive';

import { useAccounts } from '#hooks/useAccounts';
import { useNavigate } from '#hooks/useNavigate';
import { useSyncedPref } from '#hooks/useSyncedPref';

export function useOnboardingRedirect() {
  const { isNarrowWidth } = useResponsive();
  const navigate = useNavigate();
  const { data: accounts = [], isSuccess, isPlaceholderData } = useAccounts();
  const [onboardingCompleted] = useSyncedPref('onboarding-completed');

  const isLoaded = isSuccess && !isPlaceholderData;
  const shouldRedirect =
    isNarrowWidth &&
    isLoaded &&
    accounts.length === 0 &&
    onboardingCompleted !== 'true';

  useEffect(() => {
    if (shouldRedirect) {
      void navigate('/welcome', { replace: true });
    }
  }, [shouldRedirect, navigate]);

  return { isLoaded, shouldRedirect };
}
