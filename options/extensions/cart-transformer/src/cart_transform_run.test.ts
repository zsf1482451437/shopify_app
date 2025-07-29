import { describe, it, expect } from 'vitest';
import { cartTransformRun } from './cart_transform_run';
import { CartTransformRunResult } from '../generated/api';

describe('cart transform function', () => {
  it('returns no operations', () => {
    const result = cartTransformRun({
      cart: {
        lines: []
      }
    });
    const expected: CartTransformRunResult = { operations: [] };

    expect(result).toEqual(expected);
  });
});