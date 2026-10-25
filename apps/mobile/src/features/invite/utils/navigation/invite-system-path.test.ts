import { resolveInviteSystemPath } from './invite-system-path';

const options = { appScheme: 'aido', kakaoScheme: 'kakao0000test' };

describe('resolveInviteSystemPath', () => {
  it.each([
    ['https://aido.kr/i/K7M2QX', '/invite/K7M2QX?source=universal_link'],
    ['https://aido.kr/i/k7m2qx/?utm_source=kakao', '/invite/K7M2QX?source=universal_link'],
    ['/i/K7M2QX', '/invite/K7M2QX?source=universal_link'],
    ['aido://invite/K7M2QX', '/invite/K7M2QX?source=app_scheme'],
    ['aido://invite', '/invite?source=app_scheme'],
    ['kakao0000test://kakaolink?inviteCode=K7M2QX', '/invite/K7M2QX?source=kakao'],
    ['https://aido.kr/i/K7M2Q0', '/invite?source=universal_link'],
    ['kakao0000test://kakaolink', '/invite?source=kakao'],
  ])('초대 링크 %s를 열면 %s로 바꾼다', (path, expected) => {
    // When
    const result = resolveInviteSystemPath(path, options);

    // Then
    expect(result).toBe(expected);
  });

  it.each([
    ['OAuth 콜백', 'aido://auth/kakao?code=abc'],
    ['서버 OAuth 콜백', 'aido://auth/callback?code=abc'],
    ['위젯 날짜', 'aido://feed?date=2026-10-25'],
    ['위젯 할 일', 'aido://todo/12'],
    ['알림', 'aido://notifications'],
    ['다른 스킴의 초대', 'other://invite/K7M2QX'],
    ['카카오 키가 다른 링크', 'kakao9999://kakaolink?inviteCode=K7M2QX'],
    ['초대가 아닌 웹 주소', 'https://aido.kr/terms'],
  ])('%s(%s)는 null을 반환해 그대로 통과시킨다', (_name, path) => {
    // When
    const result = resolveInviteSystemPath(path, options);

    // Then
    expect(result).toBeNull();
  });

  it('카카오 키가 없는 빌드는 카카오 링크를 통과시킨다', () => {
    // When
    const result = resolveInviteSystemPath('kakao0000test://kakaolink?inviteCode=K7M2QX', {
      appScheme: 'aido',
      kakaoScheme: null,
    });

    // Then
    expect(result).toBeNull();
  });
});
