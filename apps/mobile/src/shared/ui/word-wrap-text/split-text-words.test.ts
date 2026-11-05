import { splitRunsIntoWords, splitWords } from './split-text-words';

describe('splitRunsIntoWords', () => {
  it('빈칸마다 단어로 나눈다', () => {
    // When
    const words = splitRunsIntoWords([{ text: '오늘 할 일을  나누거나' }]);

    // Then
    expect(words.map((word) => word[0]?.text)).toEqual(['오늘', '할', '일을', '나누거나']);
  });

  it('한 단어에 붙은 밑줄 조각은 끊지 않는다', () => {
    // When
    const words = splitRunsIntoWords([
      { text: '오늘 ' },
      { text: '치과', isUnderlined: true },
      { text: '에 가요' },
    ]);

    // Then
    expect(words).toEqual([
      [{ text: '오늘' }],
      [{ text: '치과', isUnderlined: true }, { text: '에' }],
      [{ text: '가요' }],
    ]);
  });

  it('빈 글은 단어가 없다', () => {
    // When
    const words = splitRunsIntoWords([{ text: '   ' }]);

    // Then
    expect(words).toEqual([]);
  });
});

describe('splitWords', () => {
  it('앞뒤 빈칸을 버린다', () => {
    // When
    const words = splitWords(' Hello  world ');

    // Then
    expect(words).toEqual(['Hello', 'world']);
  });
});
