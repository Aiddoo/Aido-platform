import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 다른 Context가 사용자 시간대를 바꾼 뒤 앞으로 할 일 시각을 다시 맞추는 작업을 같은 트랜잭션에 등록한다
export abstract class TodoTimezoneRebaseQueuePort {
  abstract enqueueRebase(userId: UserId, at: Temporal.Instant): Promise<void>;
}
