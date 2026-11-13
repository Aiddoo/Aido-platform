import { isMyPageMenuItemSelected } from './my-page-menu.view-model';

describe('isMyPageMenuItemSelected', () => {
  it('같은 경로면 선택된 항목이다', () => {
    // When
    const result = isMyPageMenuItemSelected('/settings/theme', '/settings/theme');

    // Then
    expect(result).toBe(true);
  });

  it('하위 화면에서도 상위 항목이 선택된다', () => {
    // When
    const result = isMyPageMenuItemSelected(
      '/settings/notifications/push',
      '/settings/notifications',
    );

    // Then
    expect(result).toBe(true);
  });

  it('이름이 접두사만 같은 다른 경로는 선택되지 않는다', () => {
    // When
    const result = isMyPageMenuItemSelected('/settings/profile-edit', '/settings/profile');

    // Then
    expect(result).toBe(false);
  });

  it('프로필에서 들어간 화면에서는 프로필이 선택된다', () => {
    // When
    const result = isMyPageMenuItemSelected('/settings/edit-name', '/settings/profile');

    // Then
    expect(result).toBe(true);
  });

  it('마이페이지 탭에서는 아무것도 선택되지 않는다', () => {
    // When
    const result = isMyPageMenuItemSelected('/mypage', '/settings/theme');

    // Then
    expect(result).toBe(false);
  });

  it('친구 초대 화면은 마이페이지에 따로 진입점이 있어 친구 관리를 선택하지 않는다', () => {
    // When
    const invite = isMyPageMenuItemSelected('/friends/invite', '/friends');
    const invitees = isMyPageMenuItemSelected('/friends/invite/invitees', '/friends');

    // Then
    expect(invite).toBe(false);
    expect(invitees).toBe(false);
  });

  it('친구 상세 화면에서는 친구 관리가 그대로 선택된다', () => {
    // When
    const result = isMyPageMenuItemSelected('/friends/user-1', '/friends');

    // Then
    expect(result).toBe(true);
  });
});
