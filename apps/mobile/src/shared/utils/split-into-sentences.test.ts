import { range } from 'es-toolkit';

import { splitIntoSentences } from './split-into-sentences';

describe('splitIntoSentences', () => {
  it('문장부호에서 나눈다', () => {
    // Given
    const text = '목표는 이탈 줄이기예요. 시안은 언제까지죠? 수요일이요.';

    // When
    const sentences = splitIntoSentences(text, 120);

    // Then
    expect(sentences).toEqual(['목표는 이탈 줄이기예요.', '시안은 언제까지죠?', '수요일이요.']);
  });

  it('문장부호가 없는 긴 말은 띄어쓰기에서 끊어 카드가 끝없이 길어지지 않게 한다', () => {
    // Given
    const text = range(40)
      .map(() => '가나다라')
      .join(' ');

    // When
    const sentences = splitIntoSentences(text, 30);

    // Then
    expect(sentences.every((sentence) => sentence.length <= 30)).toBe(true);
    expect(sentences.join(' ')).toBe(text);
  });

  it('최대 길이와 같은 문장은 나누지 않는다', () => {
    // Given
    const text = '가'.repeat(10);

    // When
    const sentences = splitIntoSentences(text, 10);

    // Then
    expect(sentences).toEqual([text]);
  });

  it('띄어쓰기가 없는 긴 말은 최대 길이에서 자른다', () => {
    // 25자 = 10 + 10 + 5
    // Given
    const text = '가'.repeat(25);

    // When
    const sentences = splitIntoSentences(text, 10);

    // Then
    expect(sentences).toEqual(['가'.repeat(10), '가'.repeat(10), '가'.repeat(5)]);
  });

  it('공백만 있으면 문장이 없다', () => {
    // When
    const sentences = splitIntoSentences('   ', 10);

    // Then
    expect(sentences).toEqual([]);
  });
});
