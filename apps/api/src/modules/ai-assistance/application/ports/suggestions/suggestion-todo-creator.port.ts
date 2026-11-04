import type { Todo, TodoRepeat } from "@aido/api";

import type { AfterCommitTask } from "#api/shared/application/ports/index";

export interface SuggestionTodoDraft {
  readonly userId: string;
  readonly title: string;
  readonly categoryId: number;
  readonly startDate: Date;
  readonly scheduledTime?: string | null;
  readonly timezone: string;
  readonly repeat: TodoRepeat;
}

/** 수락한 제안을 할 일로 만든다. 활성 UoW 안에서 저장하고 afterCommit은 커밋 뒤에만 실행되게 등록한다. */
export interface SuggestionTodoCreatorPort {
  stage(draft: SuggestionTodoDraft): Promise<{
    readonly todos: readonly Todo[];
    readonly afterCommit: AfterCommitTask;
  }>;
}
