import { parseInviteCode } from './invite.schema';

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
