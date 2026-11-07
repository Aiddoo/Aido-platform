import { InviteCodePolicy } from './invite-code.model';

describe('normalizeInviteCodeInput', () => {
  it('붙여 넣은 공백·하이픈·소문자를 서버 형태로 맞춘 값을 반환한다', () => {
    // When
    const result = InviteCodePolicy.normalizeInviteCodeInput(' k7m-2 qx ');

    // Then
    expect(result).toBe('K7M2QX');
  });

  it('6자를 넘으면 앞 6자만 반환한다', () => {
    // When
    const result = InviteCodePolicy.normalizeInviteCodeInput('K7M2QXZZ');

    // Then
    expect(result).toBe('K7M2QX');
  });

  it('전각 영숫자와 전각 하이픈을 반각으로 바꾼 값을 반환한다', () => {
    // When
    const result = InviteCodePolicy.normalizeInviteCodeInput('ｋ７ｍ－２ＱＸ');

    // Then
    // NFKC: ｋ→k, ７→7, －→- 뒤 하이픈 제거·대문자
    expect(result).toBe('K7M2QX');
  });
});

describe('parseInviteCode', () => {
  it('정규화하면 6자 코드가 되는 값은 코드를 반환한다', () => {
    // When
    const result = InviteCodePolicy.parseInviteCode('k7m2-qx');

    // Then
    expect(result).toBe('K7M2QX');
  });

  it.each(['K7M2Q0', 'K7M2QO', 'K7M2Q1', 'K7M2QI', 'K7M2QL'])(
    '헷갈리는 글자가 섞인 %s는 null을 반환한다',
    (raw) => {
      // When
      const result = InviteCodePolicy.parseInviteCode(raw);

      // Then
      expect(result).toBeNull();
    },
  );

  it.each(['K7M2Q', 'K7M2QXZ', '', null, 123])(
    '길이나 형식이 맞지 않는 %p는 null을 반환한다',
    (raw) => {
      // When
      const result = InviteCodePolicy.parseInviteCode(raw);

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
    const result = InviteCodePolicy.isFilledInviteCode(raw);

    // Then
    expect(result).toBe(expected);
  });
});

describe('findInvalidCharacters', () => {
  it.each(['0', 'O', '1', 'I', 'L'])('헷갈리기 쉬운 %s는 confusable로 분류한다', (character) => {
    // When
    const [invalid] = InviteCodePolicy.findInvalidCharacters(character);

    // Then
    expect(invalid?.kind).toBe('confusable');
  });

  it.each(['A', 'E', 'U', 'Y', '!', '가'])(
    '그 밖에 코드에 없는 %s는 unused로 분류한다',
    (character) => {
      // When
      const [invalid] = InviteCodePolicy.findInvalidCharacters(character);

      // Then
      expect(invalid?.kind).toBe('unused');
    },
  );
});
