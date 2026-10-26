import {
  isSettingsMenuItemSelected,
  resolveSettingsMenuNavigation,
} from './settings-menu-navigation';

describe('resolveSettingsMenuNavigation', () => {
  it('마이페이지 탭에서는 설정으로 push한다', () => {
    expect(resolveSettingsMenuNavigation('/mypage', '/settings/theme')).toBe('push');
  });

  it('설정 화면에서 다른 설정으로 가면 상세를 교체한다', () => {
    expect(resolveSettingsMenuNavigation('/settings/theme', '/settings/language')).toBe('replace');
  });

  it('설정 안의 중첩 화면에서도 교체한다', () => {
    expect(resolveSettingsMenuNavigation('/settings/notifications/push', '/settings/theme')).toBe(
      'replace',
    );
  });

  it('설정 밖 화면으로 가면 push한다', () => {
    expect(resolveSettingsMenuNavigation('/settings/theme', '/friends')).toBe('push');
  });
});

describe('isSettingsMenuItemSelected', () => {
  it('같은 경로면 선택된 항목이다', () => {
    expect(isSettingsMenuItemSelected('/settings/theme', '/settings/theme')).toBe(true);
  });

  it('하위 화면에서도 상위 항목이 선택된다', () => {
    expect(
      isSettingsMenuItemSelected('/settings/notifications/push', '/settings/notifications'),
    ).toBe(true);
  });

  it('이름이 접두사만 같은 다른 경로는 선택되지 않는다', () => {
    expect(isSettingsMenuItemSelected('/settings/profile-edit', '/settings/profile')).toBe(false);
  });

  it('마이페이지 탭에서는 아무것도 선택되지 않는다', () => {
    expect(isSettingsMenuItemSelected('/mypage', '/settings/theme')).toBe(false);
  });

  it('친구 초대 화면은 마이페이지에 따로 진입점이 있어 친구 관리를 선택하지 않는다', () => {
    expect(isSettingsMenuItemSelected('/friends/invite', '/friends')).toBe(false);
    expect(isSettingsMenuItemSelected('/friends/invite/invitees', '/friends')).toBe(false);
  });

  it('친구 상세 화면에서는 친구 관리가 그대로 선택된다', () => {
    expect(isSettingsMenuItemSelected('/friends/user-1', '/friends')).toBe(true);
  });
});
