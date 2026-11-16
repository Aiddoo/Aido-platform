import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

/** 다른 Context(AI 제안)가 반복 규칙 테이블을 직접 읽지 않고 진행 중인 반복 할 일 제목을 받는 조회 포트 */
export abstract class RepeatingTodoTitleReaderPort {
  /** 더 만들 회차가 남은 반복의 제목이다. 끝났거나 지운 반복은 없고, 같은 제목은 한 번이며 순서는 정하지 않는다 */
  abstract listActiveTitles(userId: UserId): Promise<string[]>;
}
