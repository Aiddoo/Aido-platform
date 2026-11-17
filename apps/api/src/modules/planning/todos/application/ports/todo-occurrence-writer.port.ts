import type { TodoVisibility } from "@aido/api/vocabulary";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoCategoryId } from "../../../todo-categories/domain/todo-category-id.vo.js";
import type { TodoOccurrenceDraft } from "../../../todo-series/domain/todo-occurrence-draft.domain-service.js";
import type { TodoSeriesId } from "../../../todo-series/domain/todo-series-id.vo.js";
import type { TodoId } from "../../domain/todo-id.vo.js";
import type { TodoOccurrenceReadModel } from "../read-models/todo-occurrence.read-model.js";

// nextIds로 받은 id와 사용자 최대값 뒤 순서를 붙인 회차
export interface TodoOccurrencePlan extends TodoOccurrenceDraft {
  readonly id: TodoId;
  readonly sortOrder: number;
}

export interface TodoOccurrencePatch {
  readonly title?: string;
  readonly categoryId?: TodoCategoryId;
  readonly visibility?: TodoVisibility;
}

export interface TodoOccurrenceTime {
  readonly todoId: TodoId;
  readonly scheduledLocalTime: string | null;
  readonly scheduledTime: Temporal.Instant | null;
}

export interface TodoOccurrenceMove {
  readonly occurrenceDate: string;
  readonly scheduledLocalTime: string | null;
  readonly scheduledTime: Temporal.Instant | null;
}

export interface CreatedOccurrence {
  readonly todoId: TodoId;
  readonly scheduledTime: Temporal.Instant | null;
}

export interface TodoOccurrenceDeletion {
  readonly userId: UserId;
  readonly seriesIds: readonly TodoSeriesId[];
  readonly fromDate?: string;
  readonly includeCompleted: boolean;
}

// todo-series가 회차 행을 만들고 고치고 지우는 유일한 문이다. 규칙 하나가 회차 수십~수백 행을 한 번에 옮기므로
// Aggregate를 하나씩 불러 저장하지 않고 업무 이름의 묶음 문장으로 쓴다
export abstract class TodoOccurrenceWriterPort {
  // 한 문장으로 count개를 오름차순으로 받는다
  abstract nextIds(count: number): Promise<TodoId[]>;

  // 같은 (seriesId, occurrenceDate)는 건너뛰어 재시도에 멱등이고 실제로 만든 행만 돌려준다. 체크리스트도 만든 행에만 복사한다
  abstract insertOccurrences(
    plans: readonly TodoOccurrencePlan[],
    seriesId: TodoSeriesId,
    checklist: readonly { title: string }[],
  ): Promise<readonly CreatedOccurrence[]>;

  // fromDate 이후(포함) 회차를 회차 날짜 순으로 준다. 옮긴 회차도 원래 회차 날짜로 찾는다
  abstract findOccurrencesFrom(
    seriesIds: readonly TodoSeriesId[],
    fromDate: string,
  ): Promise<readonly TodoOccurrenceReadModel[]>;

  // fromDate 이후(포함) 미완료 회차의 내용을 함께 고친다. 완료한 회차는 기록이라 두지 않는다
  abstract updateFollowingOccurrences(
    seriesId: TodoSeriesId,
    fromDate: string,
    patch: TodoOccurrencePatch,
  ): Promise<void>;

  // 회차마다 값이 다른 시각을 한 문장으로 저장한다
  abstract updateOccurrenceTimes(times: readonly TodoOccurrenceTime[]): Promise<void>;

  // 할 일 id를 유지한 채 다른 규칙으로 옮겨 댓글·진행을 보존한다
  abstract reassignOccurrences(todoIds: readonly TodoId[], toSeriesId: TodoSeriesId): Promise<void>;

  // 새 규칙에 없는 날짜의 기준 회차를 맞는 날짜로 옮긴다
  abstract moveOccurrence(todoId: TodoId, move: TodoOccurrenceMove): Promise<void>;

  // 규칙들의 fromDate 이후 회차를 지우고 지운 id를 돌려준다. 완료 회차는 includeCompleted일 때만 지운다
  abstract deleteOccurrences(deletion: TodoOccurrenceDeletion): Promise<readonly number[]>;

  abstract deleteMany(todoIds: readonly TodoId[]): Promise<void>;
}
