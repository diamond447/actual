import { describe, expect, it } from 'vitest';

import { parseCategoryAppearance } from './useCategoryAppearance';

describe('parseCategoryAppearance defensive JSON parsing', () => {
  const category = { id: 'cat-groceries', name: 'Potraviny' };

  it('parses valid JSON with known icon and color', () => {
    const raw = JSON.stringify({ icon: 'coffee', color: 'amber' });
    const result = parseCategoryAppearance(raw, category.name, category.id);
    expect(result).toEqual({ icon: 'coffee', color: 'amber' });
  });

  it('falls back to guessed values when raw is null, undefined, or empty', () => {
    const fallback = parseCategoryAppearance(
      undefined,
      category.name,
      category.id,
    );
    expect(fallback).toEqual({ icon: 'cart', color: 'green' });

    expect(parseCategoryAppearance(null, category.name, category.id)).toEqual(
      fallback,
    );
    expect(parseCategoryAppearance('', category.name, category.id)).toEqual(
      fallback,
    );
  });

  it('falls back to guessed values on invalid JSON syntax without throwing', () => {
    const invalidStrings = [
      '{invalid json',
      'not json at all',
      '{icon: "cart"}',
      'undefined',
      'NaN',
      '<xml></xml>',
    ];

    for (const raw of invalidStrings) {
      expect(() =>
        parseCategoryAppearance(raw, category.name, category.id),
      ).not.toThrow();
      expect(parseCategoryAppearance(raw, category.name, category.id)).toEqual({
        icon: 'cart',
        color: 'green',
      });
    }
  });

  it('falls back to guessed values on non-object JSON values', () => {
    expect(parseCategoryAppearance('123', category.name, category.id)).toEqual({
      icon: 'cart',
      color: 'green',
    });
    expect(parseCategoryAppearance('true', category.name, category.id)).toEqual(
      { icon: 'cart', color: 'green' },
    );
    expect(
      parseCategoryAppearance('["cart", "green"]', category.name, category.id),
    ).toEqual({ icon: 'cart', color: 'green' });
    expect(
      parseCategoryAppearance('"plain string"', category.name, category.id),
    ).toEqual({ icon: 'cart', color: 'green' });
  });

  it('falls back only the icon when icon ID is unknown', () => {
    const raw = JSON.stringify({ icon: 'unknown-icon-id', color: 'purple' });
    const result = parseCategoryAppearance(raw, category.name, category.id);
    // Guessed icon for Potraviny is 'cart'
    expect(result).toEqual({ icon: 'cart', color: 'purple' });
  });

  it('falls back only the color when color ID is unknown', () => {
    const raw = JSON.stringify({ icon: 'plane', color: 'neon-rainbow' });
    const result = parseCategoryAppearance(raw, category.name, category.id);
    // Guessed color for Potraviny is 'green'
    expect(result).toEqual({ icon: 'plane', color: 'green' });
  });

  it('falls back both when both icon and color IDs are unknown', () => {
    const raw = JSON.stringify({ icon: 'fake-icon', color: 'fake-color' });
    const result = parseCategoryAppearance(raw, category.name, category.id);
    expect(result).toEqual({ icon: 'cart', color: 'green' });
  });

  it('tolerates extra properties in JSON', () => {
    const raw = JSON.stringify({
      icon: 'heart',
      color: 'pink',
      extraField: 42,
      nested: { a: 1 },
    });
    const result = parseCategoryAppearance(raw, category.name, category.id);
    expect(result).toEqual({ icon: 'heart', color: 'pink' });
  });
});
