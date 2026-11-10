import type { TodoVisibility } from "@aido/api/vocabulary";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { ValueObject } from "#api/shared/domain/model/value-object";

export interface NudgeTargetTodoValue {
  readonly ownerId: string;
  readonly title: string;
  readonly visibility: TodoVisibility;
  readonly startDate: Temporal.PlainDate;
  readonly endDate: Temporal.PlainDate | null;
}

// 콕을 찌를 친구의 할 일. planning이 저장한 값을 읽기만 해서 복원만 있다
export class NudgeTargetTodo extends ValueObject<NudgeTargetTodoValue> {
  static reconstitute(value: NudgeTargetTodoValue): NudgeTargetTodo {
    return new NudgeTargetTodo({ ...value });
  }

  get title(): string {
    return this.value.title;
  }

  isOwnedBy(userId: UserId): boolean {
    return this.value.ownerId === userId.value;
  }

  isPublic(): boolean {
    return this.value.visibility === "PUBLIC";
  }

  // 기간 할 일은 시작·종료일 사이, 하루 할 일은 시작일 당일에만 찌를 수 있다
  isActiveOn(date: Temporal.PlainDate): boolean {
    const { startDate, endDate } = this.value;
    if (endDate == null) {
      return startDate.equals(date);
    }
    return (
      Temporal.PlainDate.compare(startDate, date) <= 0 &&
      Temporal.PlainDate.compare(date, endDate) <= 0
    );
  }
}
