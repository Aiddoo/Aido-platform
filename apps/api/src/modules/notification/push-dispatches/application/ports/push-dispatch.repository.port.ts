import type { PushDispatchId } from "../../domain/push-dispatch-id.vo.js";
import type { PushDispatch } from "../../domain/push-dispatch.aggregate.js";

// 알림 트랜잭션 안에서 발송과 전용 아웃박스를 함께 쓴다. 묶음 발행이 수백 건을 한 번에 넣어 묶음 메서드다
export abstract class PushDispatchRepositoryPort {
  abstract nextIds(count: number): Promise<PushDispatchId[]>;
  abstract saveAll(dispatches: readonly PushDispatch[]): Promise<void>;
}
