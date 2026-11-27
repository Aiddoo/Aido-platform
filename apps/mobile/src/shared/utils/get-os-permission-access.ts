import type { OsPermission } from '@src/core/ports/os-permission';

/** `settings`는 OS가 다시 묻지 않아 설정 앱에서만 켤 수 있다 */
export type OsPermissionAccess = 'granted' | 'ask' | 'settings';

export function getOsPermissionAccess(permission: OsPermission): OsPermissionAccess {
  if (permission.status === 'granted') {
    return 'granted';
  }
  return permission.canAskAgain ? 'ask' : 'settings';
}
