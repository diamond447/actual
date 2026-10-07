import type { SyncedPrefs } from '@actual-app/core/types/prefs';

export type OnboardingLanguage = 'cs' | 'en';
export type OnboardingCurrency = 'CZK' | 'EUR' | 'USD';

export function resolveInitialLanguage(
  globalLanguage?: string | null,
  browserLanguage?: string | null,
): OnboardingLanguage {
  if (globalLanguage) {
    return globalLanguage.toLowerCase().startsWith('cs') ? 'cs' : 'en';
  }
  if (browserLanguage) {
    return browserLanguage.toLowerCase().startsWith('cs') ? 'cs' : 'en';
  }
  return 'en';
}

export function resolveInitialCurrency(
  language: OnboardingLanguage,
): OnboardingCurrency {
  return language === 'cs' ? 'CZK' : 'EUR';
}

export function getCurrencyPrefs(
  currency: OnboardingCurrency,
  language: OnboardingLanguage,
): SyncedPrefs {
  const isCzech = language === 'cs';
  const base: SyncedPrefs = {
    'flags.currency': 'true',
  };

  if (isCzech) {
    base.dateFormat = 'dd.MM.yyyy';
    base.firstDayOfWeekIdx = '1';
  }

  switch (currency) {
    case 'CZK':
      return {
        ...base,
        defaultCurrencyCode: 'CZK',
        numberFormat: 'space-comma',
        currencySymbolPosition: 'after',
        currencySpaceBetweenAmountAndSymbol: 'true',
        hideFraction: 'false',
      };
    case 'EUR':
      return {
        ...base,
        defaultCurrencyCode: 'EUR',
        numberFormat: isCzech ? 'space-comma' : 'comma-dot',
        currencySymbolPosition: isCzech ? 'after' : 'before',
        currencySpaceBetweenAmountAndSymbol: isCzech ? 'true' : 'false',
        hideFraction: 'false',
      };
    case 'USD':
      return {
        ...base,
        defaultCurrencyCode: 'USD',
        numberFormat: 'comma-dot',
        currencySymbolPosition: 'before',
        currencySpaceBetweenAmountAndSymbol: 'false',
        hideFraction: 'false',
      };
    default:
      return {
        ...base,
        defaultCurrencyCode: 'EUR',
        numberFormat: isCzech ? 'space-comma' : 'comma-dot',
        currencySymbolPosition: isCzech ? 'after' : 'before',
        currencySpaceBetweenAmountAndSymbol: isCzech ? 'true' : 'false',
        hideFraction: 'false',
      };
  }
}
