import type { TodoVisibility } from "@aido/api/vocabulary";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { ValueObject } from "#api/shared/domain/model/value-object";

import { canNudgeTodoOn, type NudgeableTodo } from "./nudge-eligibility.domain-service.js";

export interface NudgeTargetTodoValue extends NudgeableTodo {
  readonly ownerId: string;
  readonly title: string;
  readonly visibility: TodoVisibility;
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

  canBeNudgedOn(date: Temporal.PlainDate): boolean {
    return canNudgeTodoOn(this.value, date);
  }
}
