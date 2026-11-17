import { ACTION_PLAN_LIMITS } from "@aido/api/vocabulary";

import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import type { PlannedVisibility } from "../../shared/domain/ai-task-outputs.constants.js";
import type { TodoRepeatRule } from "../../shared/domain/todo-draft.constants.js";
import type { PlannedMemoDraft } from "./action-plan-drafts.constants.js";
import { invalidActionPlanDraft } from "./action-plan-drafts.errors.js";

/** 일정을 날짜·시각·반복으로 계산한 할 일. 적용 전까지 서버에 저장하지 않는다. */
interface ActionPlanTodo {
  readonly title: string;
  readonly categoryId: number | null;
  readonly startDate: string;
  /** 반복 할 일은 기간을 쓰지 않아 null이다 */
  readonly endDate: string | null;
  readonly scheduledTime: string | null;
  readonly repeat: TodoRepeatRule | null;
  readonly visibility: PlannedVisibility | null;
  readonly items: readonly string[];
  readonly duplicateOfTodoId: number | null;
}

export interface ActionPlanDraftPrimitives {
  readonly todos: readonly ActionPlanTodo[];
  readonly memo: PlannedMemoDraft | null;
  /** 할 일 상한을 넘어 버린 할 일 수 */
  readonly omittedTodoCount: number;
}

type ActionPlanDraftProps = ActionPlanDraftPrimitives;

type CreateActionPlanDraftParams = ActionPlanDraftProps;

/**
 * 말·글에서 만든 실행 계획 한 건. 저장하지 않고 사용자가 확인한 행동만 적용 API로 받는다.
 * 할 일은 계획 상한 이하이고, 반복 할 일은 기간(endDate)을 쓰지 않는다(생성 포트가 함께 받으면 거절한다).
 */
export class ActionPlanDraft extends AggregateRoot<null, ActionPlanDraftProps> {
  static create(params: CreateActionPlanDraftParams): ActionPlanDraft {
    const { todos, memo, omittedTodoCount } = params;
    if (todos.length > ACTION_PLAN_LIMITS.MAX_TODOS) {
      throw invalidActionPlanDraft("action plan must keep at most MAX_TODOS todos");
    }
    if (!Number.isInteger(omittedTodoCount) || omittedTodoCount < 0) {
      throw invalidActionPlanDraft("omitted todo count must be a non-negative integer");
    }
    return new ActionPlanDraft(null, {
      todos: todos.map((todo) => ({
        ...todo,
        endDate: todo.repeat == null ? todo.endDate : null,
      })),
      memo,
      omittedTodoCount,
    });
  }

  toPrimitives(): ActionPlanDraftPrimitives {
    return { ...this.props };
  }
}
