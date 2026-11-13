/** OS 권한 원본 값(expo `PermissionResponse`와 같은 모양). 허용은 `status === 'granted'`로 판정한다 */
export type OsPermissionStatus = 'granted' | 'denied' | 'undetermined';

export interface OsPermission {
  status: OsPermissionStatus;
  canAskAgain: boolean;
}
