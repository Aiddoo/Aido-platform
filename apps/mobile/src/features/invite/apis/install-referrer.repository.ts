import type { InstallReferrerGateway } from '@src/core/ports/install-referrer';
import type { SyncStorage } from '@src/core/ports/sync-storage';

const INSTALL_REFERRER_CHECKED_KEY = 'aido_install_referrer_checked_v1';

export interface InstallReferrerRepository {
  hasChecked(): boolean;
  markChecked(): void;
  read(): Promise<string | null>;
}

/** 설치 referrer는 앱을 지우기 전까지 그대로 남아서 처음 실행 때 한 번만 읽는다 */
export function createInstallReferrerRepository(
  storage: SyncStorage,
  gateway: InstallReferrerGateway,
): InstallReferrerRepository {
  return {
    hasChecked: () => storage.getString(INSTALL_REFERRER_CHECKED_KEY) != null,
    markChecked: () => storage.set(INSTALL_REFERRER_CHECKED_KEY, '1'),
    read: () => gateway.read(),
  };
}
