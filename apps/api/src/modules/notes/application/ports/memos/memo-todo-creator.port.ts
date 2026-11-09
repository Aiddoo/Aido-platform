import type { Todo, TodoRepeat } from "@aido/api";
import type { TodoVisibility } from "@aido/api/vocabulary";

import type { AfterCommitTask } from "#api/shared/application/ports/index";

export interface MemoTodoDraft {
  readonly userId: string;
  readonly title: string;
  readonly categoryId: number;
  readonly startDate: Date;
  readonly endDate?: Date | null;
  readonly scheduledTime?: string | null;
  readonly timezone: string | undefined;
  readonly isAllDay?: boolean;
  readonly visibility?: TodoVisibility;
  readonly items?: readonly { title: string }[];
  readonly repeat?: TodoRepeat | null;
  /** 출시 앱의 isRecurring 변환 전용. 옛 서버에 없던 상한으로 거절하지 않는다. */
  readonly usesLegacySeriesLimit?: boolean;
}

/** 메모를 할 일로 바꾼다. 활성 UoW 안에서 저장하고 afterCommit은 커밋 뒤에만 실행되게 등록한다. */
export interface MemoTodoCreatorPort {
  stage(draft: MemoTodoDraft): Promise<{
    readonly todos: readonly Todo[];
    readonly afterCommit: AfterCommitTask;
  }>;
}
