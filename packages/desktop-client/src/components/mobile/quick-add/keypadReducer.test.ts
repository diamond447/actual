import { describe, expect, it } from 'vitest';

import {
  formatIntegerPart,
  formatKeypadDisplay,
  getAmountAsInteger,
  getAmountAsNumber,
  INITIAL_KEYPAD_STATE,
  keypadReducer,
  MAX_FRACTION_DIGITS,
  MAX_INTEGER_DIGITS,
} from './keypadReducer';
import type { KeypadState } from './keypadReducer';

function pressKeys(keys: string[], initialState = INITIAL_KEYPAD_STATE) {
  return keys.reduce<KeypadState>((state, key) => {
    if (key === '.') {
      return keypadReducer(state, { type: 'decimal' });
    }
    if (key === '⌫' || key === 'backspace') {
      return keypadReducer(state, { type: 'backspace' });
    }
    if (key === 'C' || key === 'clear') {
      return keypadReducer(state, { type: 'clear' });
    }
    return keypadReducer(state, { type: 'digit', digit: key });
  }, initialState);
}

describe('keypadReducer', () => {
  it('starts at initial state of 0', () => {
    expect(INITIAL_KEYPAD_STATE).toEqual({
      integer: '0',
      fraction: '',
      hasDecimal: false,
    });
    expect(getAmountAsNumber(INITIAL_KEYPAD_STATE)).toBe(0);
    expect(getAmountAsInteger(INITIAL_KEYPAD_STATE)).toBe(0);
    expect(formatKeypadDisplay(INITIAL_KEYPAD_STATE)).toBe('0');
  });

  describe('typing whole numbers', () => {
    it('types digits and converts to whole currency units (123 = 123,00)', () => {
      const state = pressKeys(['1', '2', '3']);
      expect(state).toEqual({
        integer: '123',
        fraction: '',
        hasDecimal: false,
      });
      expect(getAmountAsNumber(state)).toBe(123);
      expect(getAmountAsInteger(state)).toBe(12300);
      expect(formatKeypadDisplay(state)).toBe('123');
    });

    it('collapses leading zeros', () => {
      const state1 = pressKeys(['0', '0']);
      expect(state1.integer).toBe('0');

      const state2 = pressKeys(['0', '5']);
      expect(state2.integer).toBe('5');

      const state3 = pressKeys(['0', '0', '7', '0']);
      expect(state3.integer).toBe('70');
      expect(getAmountAsInteger(state3)).toBe(7000);
    });

    it('caps integer part at 9 digits', () => {
      const nineDigits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
      const state = pressKeys(nineDigits);
      expect(state.integer).toBe('123456789');
      expect(state.integer.length).toBe(MAX_INTEGER_DIGITS);

      // Typing more digits should be ignored
      const stateExtra = keypadReducer(state, { type: 'digit', digit: '0' });
      expect(stateExtra.integer).toBe('123456789');
    });
  });

  describe('decimals', () => {
    it('enters decimal mode and types fractions up to 2 decimal places', () => {
      let state = pressKeys(['1', '2', '3', '.']);
      expect(state).toEqual({
        integer: '123',
        fraction: '',
        hasDecimal: true,
      });
      expect(formatKeypadDisplay(state, '.', ',')).toBe('123.');

      state = keypadReducer(state, { type: 'digit', digit: '4' });
      expect(state.fraction).toBe('4');
      expect(getAmountAsNumber(state)).toBe(123.4);
      expect(getAmountAsInteger(state)).toBe(12340);
      expect(formatKeypadDisplay(state, '.', ',')).toBe('123.4');

      state = keypadReducer(state, { type: 'digit', digit: '5' });
      expect(state.fraction).toBe('45');
      expect(getAmountAsNumber(state)).toBe(123.45);
      expect(getAmountAsInteger(state)).toBe(12345);
      expect(formatKeypadDisplay(state, '.', ',')).toBe('123.45');

      // 3rd decimal digit is ignored
      const stateIgnored = keypadReducer(state, {
        type: 'digit',
        digit: '6',
      });
      expect(stateIgnored.fraction).toBe('45');
      expect(stateIgnored.fraction.length).toBe(MAX_FRACTION_DIGITS);
    });

    it('ignores duplicate decimal separator presses', () => {
      const state = pressKeys(['5', '.', '.']);
      expect(state).toEqual({
        integer: '5',
        fraction: '',
        hasDecimal: true,
      });
    });

    it('handles decimal input starting from 0', () => {
      let state = pressKeys(['.', '0', '5']);
      expect(state).toEqual({
        integer: '0',
        fraction: '05',
        hasDecimal: true,
      });
      expect(getAmountAsNumber(state)).toBe(0.05);
      expect(getAmountAsInteger(state)).toBe(5);

      state = pressKeys(['.', '5']);
      expect(getAmountAsNumber(state)).toBe(0.5);
      expect(getAmountAsInteger(state)).toBe(50);
    });
  });

  describe('backspace', () => {
    it('removes decimal digits first', () => {
      let state = pressKeys(['1', '2', '.', '3', '4']);
      expect(state.fraction).toBe('34');

      state = keypadReducer(state, { type: 'backspace' });
      expect(state.fraction).toBe('3');
      expect(state.hasDecimal).toBe(true);
      expect(getAmountAsInteger(state)).toBe(1230);
    });

    it('crosses the decimal separator on backspace', () => {
      let state = pressKeys(['1', '2', '.', '3']);
      // Backspace removes '3'
      state = keypadReducer(state, { type: 'backspace' });
      expect(state).toEqual({
        integer: '12',
        fraction: '',
        hasDecimal: true,
      });

      // Backspace removes the decimal point
      state = keypadReducer(state, { type: 'backspace' });
      expect(state).toEqual({
        integer: '12',
        fraction: '',
        hasDecimal: false,
      });
      expect(getAmountAsInteger(state)).toBe(1200);

      // Subsequent backspaces remove integer digits
      state = keypadReducer(state, { type: 'backspace' });
      expect(state.integer).toBe('1');

      state = keypadReducer(state, { type: 'backspace' });
      expect(state.integer).toBe('0');

      // Backspacing on 0 keeps 0
      state = keypadReducer(state, { type: 'backspace' });
      expect(state.integer).toBe('0');
    });

    it('removes decimal directly when no fraction was typed yet', () => {
      let state = pressKeys(['5', '.']);
      expect(state.hasDecimal).toBe(true);

      state = keypadReducer(state, { type: 'backspace' });
      expect(state.hasDecimal).toBe(false);
      expect(state.integer).toBe('5');
    });
  });

  describe('clear', () => {
    it('resets state to initial', () => {
      const state = pressKeys(['9', '8', '7', '.', '6', '5']);
      const cleared = keypadReducer(state, { type: 'clear' });
      expect(cleared).toEqual(INITIAL_KEYPAD_STATE);
    });
  });

  describe('formatting display', () => {
    it('formats thousands separators in integer part', () => {
      expect(formatIntegerPart('1234567', ',')).toBe('1,234,567');
      expect(formatIntegerPart('1234567', '.')).toBe('1.234.567');
      expect(formatIntegerPart('1234567', '\u202F')).toBe(
        '1\u202F234\u202F567',
      );
      expect(formatIntegerPart('500', ',')).toBe('500');
    });

    it('formats full display with comma-dot format', () => {
      const state = pressKeys(['1', '2', '3', '4', '.', '5']);
      expect(formatKeypadDisplay(state, '.', ',')).toBe('1,234.5');
    });

    it('formats full display with dot-comma format (German/European)', () => {
      const state = pressKeys(['1', '2', '3', '4', '.', '5']);
      expect(formatKeypadDisplay(state, ',', '.')).toBe('1.234,5');
    });

    it('shows trailing decimal separator when fraction is empty', () => {
      const state = pressKeys(['1', '0', '0', '.']);
      expect(formatKeypadDisplay(state, ',', '.')).toBe('100,');
      expect(formatKeypadDisplay(state, '.', ',')).toBe('100.');
    });
  });
});
