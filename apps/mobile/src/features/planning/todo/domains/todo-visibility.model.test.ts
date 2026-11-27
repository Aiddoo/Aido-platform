import { getToggledVisibility, getVisibility, isPrivateVisibility } from './todo-visibility.model';

describe('getVisibility', () => {
  it.each([
    [null, 'PUBLIC'],
    ['PUBLIC', 'PUBLIC'],
    ['PRIVATE', 'PRIVATE'],
  ] as const)('공개 범위를 %s로 두면 %s로 본다', (visibility, expected) => {
    // When
    const result = getVisibility(visibility);

    // Then
    expect(result).toBe(expected);
  });
});

describe('isPrivateVisibility', () => {
  it('비공개로 정한 할 일만 비공개다', () => {
    // When
    const results = [
      isPrivateVisibility('PRIVATE'),
      isPrivateVisibility('PUBLIC'),
      isPrivateVisibility(null),
    ];

    // Then
    expect(results).toEqual([true, false, false]);
  });
});

describe('getToggledVisibility', () => {
  it.each([
    ['PRIVATE', 'PUBLIC'],
    ['PUBLIC', 'PRIVATE'],
    [null, 'PRIVATE'],
  ] as const)('공개 범위가 %s이면 %s로 바꾼다', (visibility, expected) => {
    // When
    const toggled = getToggledVisibility(visibility);

    // Then
    expect(toggled).toBe(expected);
  });
});
