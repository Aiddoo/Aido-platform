import { isFontScale } from './font-scale.preference';

describe('isFontScale', () => {
  it.each(['xsmall', 'small', 'medium', 'large', 'xlarge'] as const)(
    '%s는 유효한 FontScale이다',
    (value) => {
      // When
      const result = isFontScale(value);

      // Then
      expect(result).toBe(true);
    },
  );

  it.each([undefined, null, '', 'invalid', 123, true])(
    '%s는 유효한 FontScale이 아니다',
    (value) => {
      // When
      const result = isFontScale(value);

      // Then
      expect(result).toBe(false);
    },
  );
});
