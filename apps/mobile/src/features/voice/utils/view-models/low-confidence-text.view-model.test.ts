import { splitLowConfidenceText } from './low-confidence-text.view-model';

describe('splitLowConfidenceText', () => {
  test('단어를 문장 안 순서대로 찾아 조각으로 나눈다', () => {
    // Given
    const text = '수요일까지 시안 두 개 부탁해요';

    // When
    const parts = splitLowConfidenceText(text, ['시안', '부탁해요']);

    // Then
    expect(parts).toEqual([
      { text: '수요일까지 ', isLowConfidence: false },
      { text: '시안', isLowConfidence: true },
      { text: ' 두 개 ', isLowConfidence: false },
      { text: '부탁해요', isLowConfidence: true },
    ]);
  });

  test('같은 단어가 두 번 있으면 앞에서부터 차례로 찾는다', () => {
    // Given
    const text = '네 네 알겠어요';

    // When
    const parts = splitLowConfidenceText(text, ['네', '네']);

    // Then
    expect(parts.filter(({ isLowConfidence }) => isLowConfidence)).toHaveLength(2);
    expect(parts.map(({ text: part }) => part).join('')).toBe(text);
  });

  test('단어가 없으면 문장 하나 그대로다', () => {
    // Given
    const text = '그대로예요';

    // When
    const parts = splitLowConfidenceText(text, []);

    // Then
    expect(parts).toEqual([{ text, isLowConfidence: false }]);
  });

  test('글자가 다른 단어는 건너뛰고 문장을 잃지 않는다', () => {
    // Given
    const text = '그대로예요';

    // When
    const parts = splitLowConfidenceText(text, ['없는말']);

    // Then
    expect(parts.map(({ text: part }) => part).join('')).toBe(text);
  });
});
