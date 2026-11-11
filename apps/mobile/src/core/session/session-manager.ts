import { emitSessionExpired } from '@src/core/events/session-expired';
import type { SessionExpiredDetails } from '@src/core/observability/telemetry-event';
import type { TokenStore } from '@src/core/ports/token-store';

/** 이 앱에서 토큰을 지우는 경로는 사용자의 로그아웃·탈퇴(`LogOutDeviceService`·`SignInService.deleteAccount`)와 여기 `end()` 둘뿐이다. 갱신기가 세션 수명을 결정하면 불변식이 주석으로만 지켜지므로 삭제 책임을 떼어냈다 */
export interface SessionManager {
  /** 세션 종료를 확정한다. 토큰을 지우고 만료 이벤트를 발행한다. */
  end(details: SessionExpiredDetails): Promise<void>;
}

export function createSessionManager(tokenStore: TokenStore): SessionManager {
  return {
    async end(details: SessionExpiredDetails): Promise<void> {
      try {
        await tokenStore.clear();
      } finally {
        // 삭제가 실패해도(기기 잠김 등) UI는 반드시 미인증으로 내려가야 한다.
        emitSessionExpired(details);
      }
    },
  };
}
