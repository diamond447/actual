import { amountToInteger } from '@actual-app/core/shared/util';

export type KeypadState = {
  integer: string;
  fraction: string;
  hasDecimal: boolean;
};

export type KeypadAction =
  | { type: 'digit'; digit: string }
  | { type: 'decimal' }
  | { type: 'backspace' }
  | { type: 'clear' };

export const INITIAL_KEYPAD_STATE: KeypadState = {
  integer: '0',
  fraction: '',
  hasDecimal: false,
};

export const MAX_INTEGER_DIGITS = 9;
export const MAX_FRACTION_DIGITS = 2;

export function keypadReducer(
  state: KeypadState,
  action: KeypadAction,
): KeypadState {
  switch (action.type) {
    case 'digit': {
      const digit = action.digit;
      if (!/^[0-9]$/.test(digit)) {
        return state;
      }

      if (state.hasDecimal) {
        if (state.fraction.length >= MAX_FRACTION_DIGITS) {
          return state;
        }
        return {
          ...state,
          fraction: state.fraction + digit,
        };
      }

      // Integer part editing: leading zeros collapse
      if (state.integer === '0') {
        if (digit === '0') {
          return state;
        }
        return {
          ...state,
          integer: digit,
        };
      }

      if (state.integer.length >= MAX_INTEGER_DIGITS) {
        return state;
      }

      return {
        ...state,
        integer: state.integer + digit,
      };
    }

    case 'decimal': {
      if (state.hasDecimal) {
        return state;
      }
      return {
        ...state,
        hasDecimal: true,
      };
    }

    case 'backspace': {
      if (state.hasDecimal) {
        if (state.fraction.length > 0) {
          return {
            ...state,
            fraction: state.fraction.slice(0, -1),
          };
        }
        // Fraction is empty: backspace across the decimal separator
        return {
          ...state,
          hasDecimal: false,
        };
      }

      if (state.integer.length > 1) {
        return {
          ...state,
          integer: state.integer.slice(0, -1),
        };
      }

      return {
        ...state,
        integer: '0',
      };
    }

    case 'clear':
      return INITIAL_KEYPAD_STATE;

    default:
      return state;
  }
}

export function getAmountAsNumber(state: KeypadState): number {
  const str =
    state.hasDecimal && state.fraction.length > 0
      ? `${state.integer}.${state.fraction}`
      : state.integer;
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

export function getAmountAsInteger(
  state: KeypadState,
  decimalPlaces: number = 2,
): number {
  return amountToInteger(getAmountAsNumber(state), decimalPlaces);
}

export function formatIntegerPart(
  integer: string,
  thousandsSeparator: string,
): string {
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator);
}

export function formatKeypadDisplay(
  state: KeypadState,
  decimalSeparator: string = '.',
  thousandsSeparator: string = ',',
): string {
  const formattedInt = formatIntegerPart(state.integer, thousandsSeparator);
  if (state.hasDecimal) {
    return `${formattedInt}${decimalSeparator}${state.fraction}`;
  }
  return formattedInt;
}
