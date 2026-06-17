import { describe, expect, it } from 'vitest';
import { GRADE_LEVEL_OPTIONS } from './grades';

describe('GRADE_LEVEL_OPTIONS', () => {
  it('includes grades from Kindergarten through 12th grade and College', () => {
    expect(GRADE_LEVEL_OPTIONS).toHaveLength(14);
    expect(GRADE_LEVEL_OPTIONS[0]).toEqual({ value: 'K', label: 'Kindergarten' });
    expect(GRADE_LEVEL_OPTIONS.at(-2)).toEqual({ value: '12', label: '12th Grade' });
    expect(GRADE_LEVEL_OPTIONS.at(-1)).toEqual({ value: 'College', label: 'College' });
  });
});
