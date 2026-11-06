import {
  hasPushedScreen,
  isMyPageMenuItemSelected,
  getMyPageMenuNavigationMode,
} from './mypage-menu-navigation';

describe('getMyPageMenuNavigationMode', () => {
  it('내 정보 탭에서는 메뉴 화면으로 push한다', () => {
    // Given
    const currentPathname = '/mypage';

    // Then
    expect(getMyPageMenuNavigationMode(currentPathname)).toBe('push');
  });

  it.each(['/settings/theme', '/settings/notifications/push', '/friends/search', '/reports/1'])(
    '메뉴 화면 %s에서는 상세를 교체한다',
    (currentPathname) => {
      // Then
      expect(getMyPageMenuNavigationMode(currentPathname)).toBe('replace');
    },
  );

  it('이름이 접두사만 같은 경로는 메뉴 화면으로 보지 않는다', () => {
    // Given
    const currentPathname = '/friends-feed';

    // Then
    expect(getMyPageMenuNavigationMode(currentPathname)).toBe('push');
  });
});

describe('hasPushedScreen', () => {
  it('가장 안쪽 Stack에 쌓인 화면이 있으면 참이다', () => {
    // Given
    const state = {
      index: 1,
      routes: [{}, { state: { index: 1, routes: [{}, {}] } }],
    };

    // Then
    expect(hasPushedScreen(state)).toBe(true);
  });

  it('바깥 Stack만 쌓여 있으면 거짓이다', () => {
    // Given
    const state = {
      index: 1,
      routes: [{}, { state: { index: 0, routes: [{}] } }],
    };

    // Then
    expect(hasPushedScreen(state)).toBe(false);
  });

  it('상태가 아직 없으면 거짓이다', () => {
    // Then
    expect(hasPushedScreen(undefined)).toBe(false);
  });
});

describe('isMyPageMenuItemSelected', () => {
  it('같은 경로면 선택된 항목이다', () => {
    expect(isMyPageMenuItemSelected('/settings/theme', '/settings/theme')).toBe(true);
  });

  it('하위 화면에서도 상위 항목이 선택된다', () => {
    expect(
      isMyPageMenuItemSelected('/settings/notifications/push', '/settings/notifications'),
    ).toBe(true);
  });

  it('이름이 접두사만 같은 다른 경로는 선택되지 않는다', () => {
    expect(isMyPageMenuItemSelected('/settings/profile-edit', '/settings/profile')).toBe(false);
  });

  it('프로필에서 들어간 화면에서는 프로필이 선택된다', () => {
    expect(isMyPageMenuItemSelected('/settings/edit-name', '/settings/profile')).toBe(true);
  });

  it('마이페이지 탭에서는 아무것도 선택되지 않는다', () => {
    expect(isMyPageMenuItemSelected('/mypage', '/settings/theme')).toBe(false);
  });

  it('친구 초대 화면은 마이페이지에 따로 진입점이 있어 친구 관리를 선택하지 않는다', () => {
    expect(isMyPageMenuItemSelected('/friends/invite', '/friends')).toBe(false);
    expect(isMyPageMenuItemSelected('/friends/invite/invitees', '/friends')).toBe(false);
  });

  it('친구 상세 화면에서는 친구 관리가 그대로 선택된다', () => {
    expect(isMyPageMenuItemSelected('/friends/user-1', '/friends')).toBe(true);
  });
});
