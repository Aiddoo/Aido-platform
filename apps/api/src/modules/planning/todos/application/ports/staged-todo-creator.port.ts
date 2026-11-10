import type { TodoVisibility } from "@aido/api/vocabulary";

import type { AfterCommitTask } from "#api/shared/application/ports/index";

import type { TodoSeriesReadModel } from "../../../todo-series/application/read-models/todo-series.read-model.js";
import type { RepeatSpec } from "../../../todo-series/domain/repeat-rule.vo.js";
import type { TodoReadModel } from "../read-models/todo.read-model.js";

/**
 * 할 일 생성 입력. 시각은 벽시계 HH:mm로 받아 timezone으로 해석한다.
 * 반복은 회차 날짜마다 다시 해석해야 해서 이미 변환한 instant로는 받지 않는다.
 */
export interface CreateTodoData {
  readonly userId: string;
  readonly title: string;
  readonly categoryId: number;
  readonly startDate: Date;
  readonly endDate?: Date | null;
  readonly scheduledTime?: string | null;
  /** 요청의 시간대. 없거나 잘못되면 저장된 사용자 시간대로 해석한다. */
  readonly timezone: string | undefined;
  readonly isAllDay?: boolean;
  readonly visibility?: TodoVisibility;
  readonly items?: readonly { title: string }[];
  readonly repeat?: RepeatSpec | null;
  /**
   * 출시 앱(1.14.x까지)의 기간이 정해진 경로 전용. 새 경로보다 넉넉한 상한을 보고, 거절은 옛 앱이
   * 아는 코드로 한다. 호환 범위는 docs/conventions/compatibility.md에 적는다.
   */
  readonly usesLegacySeriesLimit?: boolean;
}

/** 시간대를 해석한 뒤의 생성 입력. 쓰기 경로는 이 값만 받는다. */
export type ResolvedCreateTodoData = CreateTodoData & { readonly timezone: string };

export interface StagedTodoCreation {
  /** 만든 할 일. 반복이면 회차를 날짜순으로 담고 맨 앞이 첫 회차다. */
  readonly todos: readonly TodoReadModel[];
  /** 반복으로 만들었을 때의 규칙. 단일 할 일은 null이다. */
  readonly series: TodoSeriesReadModel | null;
  readonly afterCommit: AfterCommitTask;
}

/**
 * 다른 Context가 쓰는 유일한 할 일 생성 경로.
 * 활성 UoW와 생성 잠금(todoCategory·todoSortOrder) 안에서 호출하고, 돌려받은 afterCommit은
 * 커밋 뒤에만 실행되도록 등록한다. 롤백되면 알림·캐시 효과가 남지 않는다.
 */
export abstract class StagedTodoCreatorPort {
  abstract stage(input: CreateTodoData): Promise<StagedTodoCreation>;
}
