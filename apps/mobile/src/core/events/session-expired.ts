import type { SessionExpiredDetails } from '@src/core/observability/telemetry-event';

import { createEventChannel } from './event-channel';

const channel = createEventChannel<SessionExpiredDetails>('session-expired');

/** 인프라는 React/DI를 모르므로 Context 대신 모듈 레벨 옵저버로 프레젠테이션 레이어에 알린다 */
export function subscribeSessionExpired(
  listener: (details: SessionExpiredDetails) => void,
): () => void {
  return channel.subscribe(listener);
}

export function emitSessionExpired(details: SessionExpiredDetails): void {
  channel.emit(details);
}
