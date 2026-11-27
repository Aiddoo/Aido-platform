import type { OsPermission } from '@src/core/ports/os-permission';

import { getOsPermissionAccess, type OsPermissionAccess } from './get-os-permission-access';

describe('getOsPermissionAccess', () => {
  it.each<[string, OsPermission, OsPermissionAccess]>([
    ['허용했으면 granted다', { status: 'granted', canAskAgain: true }, 'granted'],
    ['묻기 전이면 시스템 창으로 묻는다', { status: 'undetermined', canAskAgain: true }, 'ask'],
    ['거절했어도 다시 물을 수 있으면 묻는다', { status: 'denied', canAskAgain: true }, 'ask'],
    [
      'OS가 다시 묻지 않으면 설정 앱으로 보낸다',
      { status: 'denied', canAskAgain: false },
      'settings',
    ],
    // 지금 어댑터는 이 조합을 만들지 않는다. 옛 캘린더 판정(denied일 때만 차단)과 갈리는 유일한 조합이다
    [
      '묻기 전인데 OS가 다시 묻지 않는다고 하면 설정 앱으로 보낸다',
      { status: 'undetermined', canAskAgain: false },
      'settings',
    ],
  ])('%s', (_case, permission, expected) => {
    // When
    const access = getOsPermissionAccess(permission);

    // Then
    expect(access).toBe(expected);
  });
});
