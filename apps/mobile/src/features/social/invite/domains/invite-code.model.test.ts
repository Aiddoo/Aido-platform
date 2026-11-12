import {
  inviteCodeSchema as inviteCodeContractSchema,
  normalizeInviteCode as normalizeInviteCodeContract,
} from '@aido/api';

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

describe('normalizePastedInviteCode', () => {
  it('빈 칸에 붙여 넣으면 공백·하이픈·소문자를 맞춘 코드를 반환한다', () => {
    // When
    const result = InviteCodePolicy.normalizePastedInviteCode('', ' k7m-2qx ');

    // Then
    expect(result).toBe('K7M2QX');
  });

  it.each([
    ['끝에', 'ABCDEFK7M2QX'],
    ['가운데에', 'ABCK7M2QXDEF'],
    ['앞에', 'K7M2QXABCDEF'],
  ])('채운 코드 %s 붙여 넣으면 붙여 넣은 코드로 바꾼다', (_position, next) => {
    // When
    const result = InviteCodePolicy.normalizePastedInviteCode('ABCDEF', next);

    // Then
    expect(result).toBe('K7M2QX');
  });

  it('붙여 넣은 글자가 코드보다 짧으면 쓰던 코드에 이어 붙인다', () => {
    // When
    const result = InviteCodePolicy.normalizePastedInviteCode('K7', 'K7m-2qx');

    // Then
    // 붙여 넣은 'm-2qx'는 정규화하면 4자라 코드 하나를 채우지 못한다
    expect(result).toBe('K7M2QX');
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

describe('parseInviteCode', () => {
  it('정규화하면 6자 코드가 되는 값은 코드를 반환한다', () => {
    // When
    const result = InviteCodePolicy.parseInviteCode('k7m2-qx');

    // Then
    expect(result).toBe('K7M2QX');
  });

  it('전각 영숫자와 하이픈은 반각으로 바꿔 읽는다', () => {
    // When
    const result = InviteCodePolicy.parseInviteCode('Ｋ７Ｍ２－ＱＸ');

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

  it.each(['k7m2-qx', ' K7M2QX ', 'K7M2Q0', 'K7M2QXZ', 'K7M2Q'])(
    '%p를 서버 초대 코드 검증과 같게 판단한다',
    (raw) => {
      // When
      const result = InviteCodePolicy.parseInviteCode(raw);

      // Then
      const contract = inviteCodeContractSchema.safeParse(raw);
      expect(result).toBe(contract.success ? contract.data : null);
    },
  );
});

describe('normalizeInviteCode', () => {
  it('공백과 하이픈을 지우고 대문자로 바꾼다', () => {
    // When
    const result = InviteCodePolicy.normalizeInviteCode(' k7m2-qx ');

    // Then
    expect(result).toBe('K7M2QX');
  });

  it('서버 정규화와 같은 값을 돌려준다', () => {
    // Given
    const raw = '  a b-c\tD-e ';

    // When
    const result = InviteCodePolicy.normalizeInviteCode(raw);

    // Then
    expect(result).toBe(normalizeInviteCodeContract(raw));
  });
});
