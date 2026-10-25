import {
  hasUnsupportedCharacter,
  isFilledInviteCode,
  parseInviteCode,
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

describe('hasUnsupportedCharacter', () => {
  it('0·O·1·I·L 중 하나가 있으면 true를 반환한다', () => {
    // When
    const result = hasUnsupportedCharacter('k7m2qo');

    // Then
    expect(result).toBe(true);
  });

  it('공백과 하이픈만 섞였으면 false를 반환한다', () => {
    // When
    const result = hasUnsupportedCharacter('K7M-2QX ');

    // Then
    expect(result).toBe(false);
  });
});
