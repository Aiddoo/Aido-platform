import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

/**
 * 저장 시간대가 바뀌면 앞으로 할 일의 재계산 작업을 등록한다.
 * 이벤트 발행은 내구성이 없어 변경을 놓칠 수 있으므로 시간대 변경과 한 트랜잭션에서 호출한다.
 */
export abstract class TodoTimezoneRebaseEnqueuerPort {
  abstract enqueueRebase(userId: UserId, at: Temporal.Instant): Promise<void>;
}
