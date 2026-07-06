import type { Storage } from '@src/core/ports/storage';
import type { SyncStorage } from '@src/core/ports/sync-storage';
import { STORAGE_KEYS } from '@src/shared/constants/storage-keys.constant';

/** MMKV(앱 삭제 시 함께 소멸)에 심는 "이 설치에서 실행된 적 있음" 플래그 키. */
export const FIRST_RUN_FLAG = 'aido.hasLaunchedBefore';

export type InitialAuthStatus = 'authenticated' | 'unauthenticated';

/**
 * 재설치 시 키체인에 잔존한 토큰으로 인한 즉시 로그아웃을 방지한다.
 *
 * iOS 키체인(SecureStore)은 앱을 삭제해도 남지만, MMKV(SyncStorage)는 삭제 시 함께 지워진다.
 * 따라서 MMKV 플래그가 없으면 "이 설치에서의 첫 실행"(신규 설치 또는 재설치)이므로,
 * 키체인에 남아있을 수 있는 이전 설치의 토큰을 선제 제거한다.
 *
 * @returns 잔존 토큰 정리를 수행했으면 true (= 미인증으로 시작해야 함)
 */
export const clearStaleTokensOnFreshInstall = async (
  secureStorage: Storage,
  flags: SyncStorage,
): Promise<boolean> => {
  if (flags.getString(FIRST_RUN_FLAG) === '1') {
    return false;
  }
  await Promise.all([
    secureStorage.remove(STORAGE_KEYS.ACCESS_TOKEN),
    secureStorage.remove(STORAGE_KEYS.REFRESH_TOKEN),
  ]);
  flags.set(FIRST_RUN_FLAG, '1');
  return true;
};

/** 앱 부팅 시 초기 인증 상태를 결정한다(재설치 잔존 토큰 가드 포함). */
export const resolveInitialAuthStatus = async (
  secureStorage: Storage,
  flags: SyncStorage,
): Promise<InitialAuthStatus> => {
  const cleared = await clearStaleTokensOnFreshInstall(secureStorage, flags);
  if (cleared) {
    return 'unauthenticated';
  }
  const token = await secureStorage.get<string>(STORAGE_KEYS.ACCESS_TOKEN);
  return token ? 'authenticated' : 'unauthenticated';
};
