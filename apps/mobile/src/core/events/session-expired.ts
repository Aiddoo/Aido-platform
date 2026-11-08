import type { SessionExpiredDetails } from '@src/core/observability/telemetry-event';

import { createEventChannel } from './event-channel';

const channel = createEventChannel<SessionExpiredDetails>();

/**
 * 세션 만료(세션 종료 확정) 이벤트 구독.
 *
 * `SessionManager`가 세션 종료를 확정했을 때 프레젠테이션 레이어가 인증 상태를 정리하고
 * 관측 이벤트를 리포팅할 수 있도록 연결하는 단방향 채널.
 * 인프라는 React/DI를 모르므로 Context 대신 모듈 레벨 옵저버를 사용한다.
 */
export function subscribeSessionExpired(
  listener: (details: SessionExpiredDetails) => void,
): () => void {
  return channel.subscribe(listener);
}

export function emitSessionExpired(details: SessionExpiredDetails): void {
  channel.emit(details);
}
