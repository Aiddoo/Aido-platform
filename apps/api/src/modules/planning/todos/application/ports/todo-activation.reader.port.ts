import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export interface TodoActivityWindow {
  readonly userId: UserId;
  readonly from: Temporal.Instant;
  readonly until: Temporal.Instant;
}

/** 다른 Context(identity 성장 지표)가 할 일 테이블을 직접 읽지 않고 기간 안에 할 일을 쓴 사용자를 받는 조회 포트 */
export abstract class TodoActivationReaderPort {
  /**
   * 사용자마다 자기 구간(from 이상 until 이하)에 할 일을 하나 이상 만들었고 할 일을 하나 이상 완료한 사용자.
   * 만든 할 일과 완료한 할 일은 달라도 된다. 한 문장으로 읽고 순서는 정하지 않는다.
   */
  abstract listActivatedUserIds(windows: readonly TodoActivityWindow[]): Promise<UserId[]>;
}
