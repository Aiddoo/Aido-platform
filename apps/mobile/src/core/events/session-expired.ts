import type { SessionExpiredReason } from '@src/core/ports/telemetry-event';

type SessionExpiredListener = (reason: SessionExpiredReason) => void;

const listeners = new Set<SessionExpiredListener>();

/**
 * 세션 만료(리프레시 토큰 무효 확정) 이벤트 구독.
 *
 * 인프라 레이어(token-refresher)가 세션 종료를 확정했을 때 프레젠테이션 레이어가
 * 인증 상태를 정리하고 관측 이벤트를 리포팅할 수 있도록 연결하는 단방향 채널.
 * 인프라는 React/DI를 모르므로 Context 대신 모듈 레벨 옵저버를 사용하며, 만료 사유(reason)만 실어 보낸다.
 */
export const subscribeSessionExpired = (listener: SessionExpiredListener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const emitSessionExpired = (reason: SessionExpiredReason): void => {
  for (const listener of [...listeners]) {
    try {
      listener(reason);
    } catch {
      // 한 리스너의 실패가 다른 리스너 알림을 막으면 안 됨
    }
  }
};
