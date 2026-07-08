import { emitSessionExpired } from '@src/core/events/session-expired';
import type { SessionExpiredDetails } from '@src/core/ports/telemetry-event';
import type { TokenStore } from '@src/core/ports/token-store';

/**
 * 세션 수명의 소유자.
 *
 * **불변식**: 이 앱에서 토큰을 지우는 경로는 둘뿐이다 —
 * (1) 사용자의 명시적 로그아웃(`AuthService`), (2) 여기 `end()`.
 * 부팅·갱신·저장소 어느 경로도 토큰을 선제 삭제하지 않는다.
 *
 * 갱신기(`TokenRefresher`)에서 삭제 책임을 떼어낸 이유가 이것이다.
 * 갱신기가 세션 수명을 결정하면 불변식이 주석으로만 지켜진다(v1.4.0 사고의 구조적 원인).
 */
export interface SessionManager {
  /** 세션 종료를 확정한다. 토큰을 지우고 만료 이벤트를 발행한다. */
  end(details: SessionExpiredDetails): Promise<void>;
}

export const createSessionManager = (tokenStore: TokenStore): SessionManager => ({
  async end(details: SessionExpiredDetails): Promise<void> {
    try {
      await tokenStore.clear();
    } finally {
      // 삭제가 실패해도(기기 잠김 등) UI는 반드시 미인증으로 내려가야 한다.
      emitSessionExpired(details);
    }
  },
});
