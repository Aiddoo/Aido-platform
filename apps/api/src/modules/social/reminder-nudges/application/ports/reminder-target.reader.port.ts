import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 리마인드를 받을 친구의 그날 할 일 수. planning이 소유한 할 일 행을 읽기만 한다
export abstract class ReminderTargetReaderPort {
  // 기간 할 일은 시작~종료일, 하루 할 일은 시작일에 센다
  abstract countTodosOn(ownerId: UserId, date: Temporal.PlainDate): Promise<number>;
}
