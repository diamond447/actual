import { getLocaleBudgetPrefs } from './localeBudgetPrefs';

describe('getLocaleBudgetPrefs', () => {
  it('returns Czech defaults for Czech languages', () => {
    expect(getLocaleBudgetPrefs('cs')).toMatchObject({
      defaultCurrencyCode: 'CZK',
      numberFormat: 'space-comma',
      dateFormat: 'dd.MM.yyyy',
    });
    expect(getLocaleBudgetPrefs('cs-CZ')).toEqual(getLocaleBudgetPrefs('cs'));
  });

  it('returns null for languages without defaults', () => {
    expect(getLocaleBudgetPrefs('en')).toBeNull();
    expect(getLocaleBudgetPrefs('en-US')).toBeNull();
  });
});
