import {
  classifyInvalidCharacter,
  findInvalidCharacters,
  isFilledInviteCode,
  parseInviteCode,
  summarizeInvalidCharacters,
  toInviteCodeDraft,
} from './invite.model';

describe('toInviteCodeDraft', () => {
  it('붙여 넣은 공백·하이픈·소문자를 서버 형태로 맞춘 값을 반환한다', () => {
    // When
    const result = toInviteCodeDraft(' k7m-2 qx ');

    // Then
    expect(result).toBe('K7M2QX');
  });

  it('6자를 넘으면 앞 6자만 반환한다', () => {
    // When
    const result = toInviteCodeDraft('K7M2QXZZ');

    // Then
    expect(result).toBe('K7M2QX');
  });

  it('전각 영숫자와 전각 하이픈을 반각으로 바꾼 값을 반환한다', () => {
    // When
    const result = toInviteCodeDraft('ｋ７ｍ－２ＱＸ');

    // Then NFKC: ｋ→k, ７→7, －→- 뒤 하이픈 제거·대문자
    expect(result).toBe('K7M2QX');
  });
});

describe('parseInviteCode', () => {
  it('정규화하면 6자 코드가 되는 값은 코드를 반환한다', () => {
    // When
    const result = parseInviteCode('k7m2-qx');

    // Then
    expect(result).toBe('K7M2QX');
  });

  it.each(['K7M2Q0', 'K7M2QO', 'K7M2Q1', 'K7M2QI', 'K7M2QL'])(
    '헷갈리는 글자가 섞인 %s는 null을 반환한다',
    (raw) => {
      // When
      const result = parseInviteCode(raw);

      // Then
      expect(result).toBeNull();
    },
  );

  it.each(['K7M2Q', 'K7M2QXZ', '', null, 123])(
    '길이나 형식이 맞지 않는 %p는 null을 반환한다',
    (raw) => {
      // When
      const result = parseInviteCode(raw);

      // Then
      expect(result).toBeNull();
    },
  );
});

describe('isFilledInviteCode', () => {
  it.each([
    ['K7M2Q', false],
    ['K7M2QX', true],
    ['K7-M2-QX', true],
  ])('%s를 입력하면 %s를 반환한다', (raw, expected) => {
    // When
    const result = isFilledInviteCode(raw);

    // Then
    expect(result).toBe(expected);
  });
});

describe('classifyInvalidCharacter', () => {
  it.each(['0', 'O', '1', 'I', 'L'])('헷갈리기 쉬운 %s는 confusable을 반환한다', (character) => {
    // When
    const result = classifyInvalidCharacter(character);

    // Then
    expect(result).toBe('confusable');
  });

  it.each(['A', 'E', 'U', 'Y', '!', '가'])(
    '그 밖에 코드에 없는 %s는 unused를 반환한다',
    (character) => {
      // When
      const result = classifyInvalidCharacter(character);

      // Then
      expect(result).toBe('unused');
    },
  );
});

describe('findInvalidCharacters', () => {
  it('코드에 없는 글자만 칸 위치와 종류를 담아 반환한다', () => {
    // When
    const result = findInvalidCharacters('123456');

    // Then 2~9는 코드에 있는 글자다
    expect(result).toEqual([{ character: '1', index: 0, kind: 'confusable' }]);
  });

  it('소문자와 하이픈을 정규화한 뒤 칸 위치를 센다', () => {
    // When
    const result = findInvalidCharacters('k7-m2qa');

    // Then 하이픈이 빠져 A는 여섯 번째 칸(인덱스 5)이 된다
    expect(result).toEqual([{ character: 'A', index: 5, kind: 'unused' }]);
  });

  it('공백과 하이픈만 섞인 올바른 코드면 빈 배열을 반환한다', () => {
    // When
    const result = findInvalidCharacters('K7M-2QX ');

    // Then
    expect(result).toEqual([]);
  });
});

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
