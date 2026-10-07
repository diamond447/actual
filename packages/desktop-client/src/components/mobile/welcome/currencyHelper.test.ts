import { describe, expect, it } from 'vitest';

import {
  getCurrencyPrefs,
  resolveInitialCurrency,
  resolveInitialLanguage,
} from './currencyHelper';

describe('currencyHelper', () => {
  describe('resolveInitialLanguage', () => {
    it('pre-selects from globalLanguage when available', () => {
      expect(resolveInitialLanguage('cs', 'en')).toBe('cs');
      expect(resolveInitialLanguage('cs-CZ', 'en')).toBe('cs');
      expect(resolveInitialLanguage('en', 'cs')).toBe('en');
      expect(resolveInitialLanguage('en-US', 'cs')).toBe('en');
    });

    it('falls back to browserLanguage when globalLanguage is unset', () => {
      expect(resolveInitialLanguage(undefined, 'cs-CZ')).toBe('cs');
      expect(resolveInitialLanguage(null, 'cs')).toBe('cs');
      expect(resolveInitialLanguage(undefined, 'en-GB')).toBe('en');
      expect(resolveInitialLanguage(undefined, 'fr-FR')).toBe('en');
    });

    it('defaults to English when neither is available', () => {
      expect(resolveInitialLanguage(undefined, undefined)).toBe('en');
    });
  });

  describe('resolveInitialCurrency', () => {
    it('pre-selects CZK for Czech and EUR otherwise', () => {
      expect(resolveInitialCurrency('cs')).toBe('CZK');
      expect(resolveInitialCurrency('en')).toBe('EUR');
    });
  });

  describe('getCurrencyPrefs', () => {
    it('returns expected synced prefs for CZK', () => {
      expect(getCurrencyPrefs('CZK', 'cs')).toEqual({
        defaultCurrencyCode: 'CZK',
        numberFormat: 'space-comma',
        currencySymbolPosition: 'after',
        currencySpaceBetweenAmountAndSymbol: 'true',
        hideFraction: 'false',
        'flags.currency': 'true',
        dateFormat: 'dd.MM.yyyy',
        firstDayOfWeekIdx: '1',
      });

      expect(getCurrencyPrefs('CZK', 'en')).toEqual({
        defaultCurrencyCode: 'CZK',
        numberFormat: 'space-comma',
        currencySymbolPosition: 'after',
        currencySpaceBetweenAmountAndSymbol: 'true',
        hideFraction: 'false',
        'flags.currency': 'true',
      });
    });

    it('returns expected synced prefs for EUR in Czech and English', () => {
      expect(getCurrencyPrefs('EUR', 'cs')).toEqual({
        defaultCurrencyCode: 'EUR',
        numberFormat: 'space-comma',
        currencySymbolPosition: 'after',
        currencySpaceBetweenAmountAndSymbol: 'true',
        hideFraction: 'false',
        'flags.currency': 'true',
        dateFormat: 'dd.MM.yyyy',
        firstDayOfWeekIdx: '1',
      });

      expect(getCurrencyPrefs('EUR', 'en')).toEqual({
        defaultCurrencyCode: 'EUR',
        numberFormat: 'comma-dot',
        currencySymbolPosition: 'before',
        currencySpaceBetweenAmountAndSymbol: 'false',
        hideFraction: 'false',
        'flags.currency': 'true',
      });
    });

    it('returns expected synced prefs for USD in Czech and English', () => {
      expect(getCurrencyPrefs('USD', 'cs')).toEqual({
        defaultCurrencyCode: 'USD',
        numberFormat: 'comma-dot',
        currencySymbolPosition: 'before',
        currencySpaceBetweenAmountAndSymbol: 'false',
        hideFraction: 'false',
        'flags.currency': 'true',
        dateFormat: 'dd.MM.yyyy',
        firstDayOfWeekIdx: '1',
      });

      expect(getCurrencyPrefs('USD', 'en')).toEqual({
        defaultCurrencyCode: 'USD',
        numberFormat: 'comma-dot',
        currencySymbolPosition: 'before',
        currencySpaceBetweenAmountAndSymbol: 'false',
        hideFraction: 'false',
        'flags.currency': 'true',
      });
    });
  });
});
