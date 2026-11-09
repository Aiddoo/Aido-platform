import type { TodoRepeat } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { MEMO_LIMITS, type TodoVisibility } from "@aido/api/vocabulary";
import { uniq } from "es-toolkit";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { truncateGraphemes } from "#api/shared/domain/utils/grapheme.util";

export interface PlannedTodo {
  readonly type: "CREATE_TODO";
  readonly key: string;
  readonly title: string;
  readonly categoryId: number;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly scheduledTime: string | null;
  readonly repeat: TodoRepeat | null;
  readonly visibility: TodoVisibility | null;
  readonly items: readonly { readonly title: string }[];
}

export interface PlannedMemo {
  readonly type: "CREATE_MEMO";
  readonly key: string;
  readonly title: string;
  readonly content: string;
}

export type PlannedAction = PlannedTodo | PlannedMemo;

function isTodo(action: PlannedAction): action is PlannedTodo {
  return action.type === "CREATE_TODO";
}

function isMemo(action: PlannedAction): action is PlannedMemo {
  return action.type === "CREATE_MEMO";
}

/** 사용자가 확인해 저장하기로 한 계획. 개수·모양은 요청 계약이 먼저 확인한다. */
export class ActionPlan {
  private constructor(
    readonly todos: readonly PlannedTodo[],
    readonly memo: PlannedMemo | null,
  ) {}

  static create(actions: readonly PlannedAction[]): ActionPlan {
    return new ActionPlan(actions.filter(isTodo), actions.find(isMemo) ?? null);
  }

  assertCategoriesOwned(owned: ReadonlySet<number>): void {
    const categoryIds = uniq(this.todos.map((todo) => todo.categoryId)).filter(
      (categoryId) => !owned.has(categoryId),
    );
    if (categoryIds.length > 0) {
      throw new DomainException(ErrorCode.AI_1315, { reason: "CATEGORY_NOT_OWNED", categoryIds });
    }
  }

  /** 메모에는 제목 칸이 없어 첫 줄에 제목을 둔다. 앱 메모 목록도 첫 줄을 제목처럼 보여 준다. */
  get memoContent(): string | null {
    if (this.memo == null) {
      return null;
    }
    const { title, content } = this.memo;
    const composed = title === "" || content.startsWith(title) ? content : `${title}\n${content}`;
    return truncateGraphemes(composed, MEMO_LIMITS.MAX_CONTENT_LENGTH);
  }
}
