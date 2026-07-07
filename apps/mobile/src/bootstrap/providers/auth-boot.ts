import type { Storage } from '@src/core/ports/storage';
import type { SyncStorage } from '@src/core/ports/sync-storage';
import { STORAGE_KEYS } from '@src/shared/constants/storage-keys.constant';
import type { TokenRefresher } from '@src/shared/infra/http/token-refresher';

/**
 * MMKV(앱 삭제 시 함께 소멸)에 심는 "이 설치에서 실행된 적 있음" 플래그 키.
 *
 * v1.3.5에서 도입된 키이므로, 플래그 부재는 "재설치"뿐 아니라
 * "플래그 도입 전 버전에서의 업데이트"도 의미한다. 따라서 플래그 부재를 근거로
 * 토큰을 삭제해서는 절대 안 된다(업데이트 시 전체 유저 강제 로그아웃 회귀 — v1.4.0).
 */
export const FIRST_RUN_FLAG = 'aido.hasLaunchedBefore';

export type InitialAuthStatus = 'authenticated' | 'unauthenticated';

/**
 * 앱 부팅 시 초기 인증 상태를 결정한다.
 *
 * 불변식: 세션 종료(토큰 삭제)는 (1) 명시적 로그아웃, (2) 서버의 definitive refresh
 * 거부(token-refresher의 expireSession) 두 경로뿐이다. 부팅 경로는 로컬 휴리스틱으로
 * 토큰을 선제 삭제하지 않고, 인증 상태를 네트워크 결과에 걸지 않는다
 * (오프라인·서버 장애에도 세션 유지).
 *
 * 재설치 잔존 무효 토큰(iOS 키체인은 앱 삭제 후에도 남음, #591)은 이 설치의 첫 부팅에
 * 한해 백그라운드 검증으로 처리한다: 토큰이 무효면 서버 401 → expireSession이 조용히
 * 정리하고, 유효하거나 네트워크가 불안하면 아무 일도 일어나지 않는다.
 */
export const resolveInitialAuthStatus = async (
  secureStorage: Storage,
  flags: SyncStorage,
  validateSession: TokenRefresher,
): Promise<InitialAuthStatus> => {
  const isFirstRunOfInstall = flags.getString(FIRST_RUN_FLAG) !== '1';
  if (isFirstRunOfInstall) {
    flags.set(FIRST_RUN_FLAG, '1');
  }

  // 세션 존재의 근거는 리프레시 토큰이다 — 액세스 토큰은 만료돼도 refresh로 재발급된다.
  const refreshToken = await secureStorage.get<string>(STORAGE_KEYS.REFRESH_TOKEN);
  if (!refreshToken) {
    return 'unauthenticated';
  }

  if (isFirstRunOfInstall) {
    // fire-and-forget: 부팅을 막지 않는다. refresher는 reject하지 않지만 방어적으로 잡는다.
    validateSession().catch(() => {});
  }
  return 'authenticated';
};
