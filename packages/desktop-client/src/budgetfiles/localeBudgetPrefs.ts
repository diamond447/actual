import type { SyncedPrefs } from '@actual-app/core/types/prefs';

const localeBudgetPrefs: Record<string, SyncedPrefs> = {
  cs: {
    defaultCurrencyCode: 'CZK',
    numberFormat: 'space-comma',
    hideFraction: 'false',
    currencySymbolPosition: 'after',
    currencySpaceBetweenAmountAndSymbol: 'true',
    dateFormat: 'dd.MM.yyyy',
    firstDayOfWeekIdx: '1',
    'flags.currency': 'true',
  },
};

/**
 * Formatting and currency prefs that a new budget should start with for
 * the given UI language, or null when the upstream defaults apply.
 */
export function getLocaleBudgetPrefs(language: string): SyncedPrefs | null {
  const baseLanguage = language.split('-')[0].toLowerCase();
  return localeBudgetPrefs[baseLanguage] ?? null;
}
