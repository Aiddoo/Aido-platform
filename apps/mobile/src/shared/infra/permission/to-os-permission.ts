import type { OsPermission } from '@src/core/ports/os-permission';
import type { PermissionResponse } from 'expo';

/** Expo 권한 모듈이 주는 값에서 앱이 쓰는 두 칸만 남긴다. `granted`는 `status`와 같은 뜻이고 `expires`는 쓰지 않는다 */
export function toOsPermission({ status, canAskAgain }: PermissionResponse): OsPermission {
  return { status, canAskAgain };
}
