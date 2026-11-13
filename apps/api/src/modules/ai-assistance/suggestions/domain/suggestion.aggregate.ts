import type { AI_SUGGESTION_STATUSES, DayOfWeek } from "@aido/api/vocabulary";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import { SuggestionId } from "./suggestion-id.vo.js";
import { suggestionAlreadyHandled, suggestionExpired } from "./suggestions.errors.js";

/** 제안 상태: PENDING(대기) → ACCEPTED(수락) | DISMISSED(거절). DB SuggestionStatus enum과 같은 튜플이다 */
export type SuggestionStatus = (typeof AI_SUGGESTION_STATUSES)[number];

export interface SuggestionPrimitives {
  readonly id: number;
  readonly userId: string;
  readonly title: string;
  /** 저장된 요일이 요일 목록 모양이 아니면 null. 수락하면 SYS_0002로 거절하고 응답은 빈 목록이다 */
  readonly daysOfWeek: readonly DayOfWeek[] | null;
  readonly scheduledTime: string | null;
  readonly confidence: number;
  readonly reason: string;
  readonly matchedTodos: readonly string[];
  readonly suggestedCategoryId: number | null;
  readonly status: SuggestionStatus;
  readonly expiresAt: Temporal.Instant;
  readonly createdAt: Temporal.Instant;
  readonly updatedAt: Temporal.Instant;
}

type SuggestionProps = Omit<SuggestionPrimitives, "id" | "userId" | "status" | "updatedAt"> & {
  readonly userId: UserId;
  status: SuggestionStatus;
  updatedAt: Temporal.Instant;
};

export interface CreateSuggestionParams {
  readonly id: SuggestionId;
  readonly userId: UserId;
  readonly title: string;
  readonly daysOfWeek: readonly DayOfWeek[];
  readonly scheduledTime: string | null;
  readonly confidence: number;
  readonly reason: string;
  readonly matchedTodos: readonly string[];
  readonly suggestedCategoryId: number | null;
  readonly expiresAt: Temporal.Instant;
  readonly now: Temporal.Instant;
}

/**
 * AI 반복 제안. 수락·거절은 대기 중이면서 만료되지 않은 제안에만 허용한다.
 * 이미 처리된 제안은 AI_1306, 만료된 제안은 AI_1307이고 처리 상태 오류가 먼저다(출시 계약 순서).
 */
export class Suggestion extends AggregateRoot<SuggestionId, SuggestionProps> {
  static create(params: CreateSuggestionParams): Suggestion {
    const { id, now, ...rest } = params;
    return new Suggestion(id, {
      ...rest,
      daysOfWeek: [...rest.daysOfWeek],
      matchedTodos: [...rest.matchedTodos],
      status: "PENDING",
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(primitives: SuggestionPrimitives): Suggestion {
    const { id, userId, ...rest } = primitives;
    return new Suggestion(SuggestionId.reconstitute(id), {
      ...rest,
      userId: UserId.reconstitute(userId),
      daysOfWeek: rest.daysOfWeek == null ? null : [...rest.daysOfWeek],
      matchedTodos: [...rest.matchedTodos],
    });
  }

  get userId(): UserId {
    return this.props.userId;
  }

  get title(): string {
    return this.props.title;
  }

  get daysOfWeek(): readonly DayOfWeek[] | null {
    return this.props.daysOfWeek;
  }

  get scheduledTime(): string | null {
    return this.props.scheduledTime;
  }

  get status(): SuggestionStatus {
    return this.props.status;
  }

  /** 대기 제안을 수락한다. 처리할 수 없으면 던지고, 상태가 바뀌므로 언제나 true다 */
  accept(now: Temporal.Instant): boolean {
    this.#ensureActionable(now);
    this.props.status = "ACCEPTED";
    this.props.updatedAt = now;
    return true;
  }

  dismiss(now: Temporal.Instant): boolean {
    this.#ensureActionable(now);
    this.props.status = "DISMISSED";
    this.props.updatedAt = now;
    return true;
  }

  isPendingAt(now: Temporal.Instant): boolean {
    return this.props.status === "PENDING" && !this.#isExpiredAt(now);
  }

  toPrimitives(): SuggestionPrimitives {
    const { userId, ...rest } = this.props;
    return {
      ...rest,
      id: this.id.value,
      userId: userId.value,
      daysOfWeek: rest.daysOfWeek == null ? null : [...rest.daysOfWeek],
      matchedTodos: [...rest.matchedTodos],
    };
  }

  #isExpiredAt(now: Temporal.Instant): boolean {
    return Temporal.Instant.compare(this.props.expiresAt, now) < 0;
  }

  #ensureActionable(now: Temporal.Instant): void {
    if (this.props.status !== "PENDING") {
      throw suggestionAlreadyHandled(this.id.value, this.props.status);
    }
    if (this.#isExpiredAt(now)) {
      throw suggestionExpired(this.id.value);
    }
  }
}
