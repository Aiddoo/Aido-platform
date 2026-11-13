import { findInvalidCharacters } from '../domains/invite-code.model';
import { summarizeInvalidCharacters } from './invite-code.view-model';

describe('summarizeInvalidCharacters', () => {
  it('없는 글자가 없으면 null을 반환한다', () => {
    // When
    const result = summarizeInvalidCharacters([]);

    // Then
    expect(result).toBeNull();
  });

  it('모두 헷갈리는 글자면 confusable로 묶고 같은 글자는 한 번만 담는다', () => {
    // Given
    const invalidCharacters = findInvalidCharacters('10O1K7');

    // When
    const result = summarizeInvalidCharacters(invalidCharacters);

    // Then
    expect(result).toEqual({
      kind: 'confusable',
      listedCharacters: ['1', '0', 'O'],
      uniqueCount: 3,
    });
  });

  it('원래 쓰지 않는 글자가 하나라도 있으면 unused로 묶는다', () => {
    // Given
    const invalidCharacters = findInvalidCharacters('1AK7M2');

    // When
    const result = summarizeInvalidCharacters(invalidCharacters);

    // Then
    expect(result).toEqual({ kind: 'unused', listedCharacters: ['1', 'A'], uniqueCount: 2 });
  });

  it('없는 글자가 3개를 넘으면 처음 3개만 담고 전체 개수를 함께 반환한다', () => {
    // Given
    const invalidCharacters = findInvalidCharacters('AEUY10');

    // When
    const result = summarizeInvalidCharacters(invalidCharacters);

    // Then
    expect(result).toEqual({
      kind: 'unused',
      listedCharacters: ['A', 'E', 'U'],
      uniqueCount: 6,
    });
  });
});
