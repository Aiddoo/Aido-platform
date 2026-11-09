import { parseInstallReferrerInviteCode } from './install-referrer';

describe('parseInstallReferrerInviteCode', () => {
  it.each([
    ['inviteCode=K7M2QX&utm_source=aido_landing', 'K7M2QX'],
    ['utm_source=aido_landing&inviteCode=k7m2qx', 'K7M2QX'],
    ['inviteCode%3DK7M2QX%26utm_source%3Daido_landing', 'K7M2QX'],
  ])('referrer %s에서 초대 코드 %s를 반환한다', (referrer, expected) => {
    // When
    const result = parseInstallReferrerInviteCode(referrer);

    // Then
    expect(result).toBe(expected);
  });

  it.each(['utm_source=google-play&utm_medium=organic', 'inviteCode=K7M2Q0', ''])(
    '초대 코드가 없거나 형식이 틀린 %p는 null을 반환한다',
    (referrer) => {
      // When
      const result = parseInstallReferrerInviteCode(referrer);

      // Then
      expect(result).toBeNull();
    },
  );
});
