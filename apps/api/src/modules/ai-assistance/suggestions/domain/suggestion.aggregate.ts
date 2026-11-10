import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { AggregateRoot } from "#api/shared/domain/index";

/** 제안 상태 — PENDING(대기) → ACCEPTED(수락) | DISMISSED(거절) */
export type SuggestionStatus = "PENDING" | "ACCEPTED" | "DISMISSED";

export interface SuggestionProps {
  readonly id: number;
  readonly userId: string;
  readonly title: string;
  /** 반복 요일 원본(Json) — 수락 입력 검증과 응답 매핑은 Application/Presentation이 담당한다 */
  readonly daysOfWeek: unknown;
  readonly scheduledTime: string | null;
  readonly confidence: number;
  readonly reason: string;
  readonly matchedTodos: unknown;
  readonly suggestedCategoryId: number | null;
  status: SuggestionStatus;
  readonly expiresAt: Date;
  readonly createdAt: Date;
  updatedAt: Date;
}

/**
 * AI 반복 제안 애그리게잇.
 *
 * 제안의 상태 전이 불변식(대기 상태·만료 여부)을 소유한다. 수락/거절 액션은
 * PENDING이면서 만료되지 않은 제안에만 허용되며, 위반 시 DomainException을 던진다.
 * daysOfWeek/matchedTodos는 저장소가 Json으로 보관하므로 원본(unknown)으로 노출하고,
 * 수락 시 요일 검증과 응답 매핑은 Application/Presentation이 담당한다.
 */
export class Suggestion extends AggregateRoot<SuggestionProps> {
  static reconstitute(props: SuggestionProps): Suggestion {
    return new Suggestion({
      ...props,
      expiresAt: new Date(props.expiresAt),
      createdAt: new Date(props.createdAt),
      updatedAt: new Date(props.updatedAt),
    });
  }

  get id(): number {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get title(): string {
    return this.props.title;
  }

  get daysOfWeek(): unknown {
    return this.props.daysOfWeek;
  }

  get scheduledTime(): string | null {
    return this.props.scheduledTime;
  }

  get confidence(): number {
    return this.props.confidence;
  }

  get reason(): string {
    return this.props.reason;
  }

  get suggestedCategoryId(): number | null {
    return this.props.suggestedCategoryId;
  }

  get status(): SuggestionStatus {
    return this.props.status;
  }

  get expiresAt(): Date {
    return new Date(this.props.expiresAt);
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }

  accept(at: Date): void {
    this.ensureActionable(at);
    this.props.status = "ACCEPTED";
    this.props.updatedAt = new Date(at);
  }

  dismiss(at: Date): void {
    this.ensureActionable(at);
    this.props.status = "DISMISSED";
    this.props.updatedAt = new Date(at);
  }

  isPending(): boolean {
    return this.props.status === "PENDING";
  }

  isExpired(at: Date): boolean {
    return this.props.expiresAt < at;
  }

  /**
   * 수락/거절 액션이 가능한 상태인지 검증한다.
   * 이미 처리된 제안은 AI_1306, 만료된 제안은 AI_1307을 던진다(레거시 순서 보존).
   */
  ensureActionable(at: Date): void {
    if (!this.isPending()) {
      throw new DomainException(ErrorCode.AI_1306, {
        suggestionId: this.props.id,
        currentStatus: this.props.status,
      });
    }
    if (this.isExpired(at)) {
      throw new DomainException(ErrorCode.AI_1307, {
        suggestionId: this.props.id,
      });
    }
  }
}
