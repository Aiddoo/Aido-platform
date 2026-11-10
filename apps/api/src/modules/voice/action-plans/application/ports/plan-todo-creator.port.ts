import type { Todo, TodoRepeat } from "@aido/api";
import type { TodoVisibility } from "@aido/api/vocabulary";

import type { AfterCommitTask } from "#api/shared/application/ports/index";

export interface PlannedTodoDraft {
  readonly userId: string;
  readonly title: string;
  readonly categoryId: number;
  readonly startDate: Date;
  readonly endDate: Date | null;
  readonly scheduledTime: string | null;
  readonly timezone: string | undefined;
  readonly isAllDay: boolean;
  readonly visibility: TodoVisibility;
  readonly items?: readonly { title: string }[];
  readonly repeat?: TodoRepeat | null;
}

/** 계획의 할 일을 만든다. 활성 UoW 안에서 저장하고 afterCommit은 커밋 뒤에만 실행되게 등록한다. */
export interface PlanTodoCreatorPort {
  stage(draft: PlannedTodoDraft): Promise<{
    readonly todos: readonly Todo[];
    readonly afterCommit: AfterCommitTask;
  }>;
}
