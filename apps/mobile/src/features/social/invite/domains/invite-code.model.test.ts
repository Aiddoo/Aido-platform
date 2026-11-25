import {
  inviteCodeSchema as inviteCodeContractSchema,
  normalizeInviteCode as normalizeInviteCodeContract,
} from '@aido/api/contracts/invite/v1';

import { getInvalidCharacters, normalizeInviteCode, parseInviteCode } from './invite-code.model';

describe('getInvalidCharacters', () => {
  it.each(['0', 'O', '1', 'I', 'L'])('헷갈리기 쉬운 %s는 confusable로 분류한다', (character) => {
    // When
    const [invalid] = getInvalidCharacters(character);

    // Then
    expect(invalid?.kind).toBe('confusable');
  });

  it.each(['A', 'E', 'U', 'Y', '!', '가'])(
    '그 밖에 코드에 없는 %s는 unused로 분류한다',
    (character) => {
      // When
      const [invalid] = getInvalidCharacters(character);

      // Then
      expect(invalid?.kind).toBe('unused');
    },
  );
});

describe('parseInviteCode', () => {
  it('정규화하면 6자 코드가 되는 값은 코드를 반환한다', () => {
    // When
    const result = parseInviteCode('k7m2-qx');

    // Then
    expect(result).toBe('K7M2QX');
  });

  it('전각 영숫자와 하이픈은 반각으로 바꿔 읽는다', () => {
    // When
    const result = parseInviteCode('Ｋ７Ｍ２－ＱＸ');

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

  it.each(['k7m2-qx', ' K7M2QX ', 'K7M2Q0', 'K7M2QXZ', 'K7M2Q'])(
    '%p를 서버 초대 코드 검증과 같게 판단한다',
    (raw) => {
      // When
      const result = parseInviteCode(raw);

      // Then
      const contract = inviteCodeContractSchema.safeParse(raw);
      expect(result).toBe(contract.success ? contract.data : null);
    },
  );
});

describe('normalizeInviteCode', () => {
  it('공백과 하이픈을 지우고 대문자로 바꾼다', () => {
    // When
    const result = normalizeInviteCode(' k7m2-qx ');

    // Then
    expect(result).toBe('K7M2QX');
  });

  it('서버 정규화와 같은 값을 돌려준다', () => {
    // Given
    const raw = '  a b-c\tD-e ';

    // When
    const result = normalizeInviteCode(raw);

    // Then
    expect(result).toBe(normalizeInviteCodeContract(raw));
  });
});
