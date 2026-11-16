import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { Entity } from "#api/shared/domain/model/entity";

import {
  RUN_STALE_AFTER_MINUTES,
  type SuggestionAnalysisOutcome,
  type SuggestionAnalysisRunStatus,
  type SuggestionAnalysisTrigger,
} from "./suggestion-analysis.constants.js";

export interface SuggestionAnalysisRunPrimitives {
  readonly userId: string;
  readonly status: SuggestionAnalysisRunStatus;
  readonly localDate: Temporal.PlainDate;
  readonly trigger: SuggestionAnalysisTrigger;
  readonly outcome: SuggestionAnalysisOutcome | null;
  readonly recentTodoCount: number | null;
  readonly createdSuggestionCount: number | null;
  readonly queuedAt: Temporal.Instant;
  readonly startedAt: Temporal.Instant | null;
  readonly finishedAt: Temporal.Instant | null;
}

type SuggestionAnalysisRunProps = Omit<
  { -readonly [K in keyof SuggestionAnalysisRunPrimitives]: SuggestionAnalysisRunPrimitives[K] },
  "userId"
>;

interface RequestSuggestionAnalysisParams {
  readonly localDate: Temporal.PlainDate;
  readonly trigger: SuggestionAnalysisTrigger;
  readonly now: Temporal.Instant;
}

interface CreateSuggestionAnalysisRunParams extends RequestSuggestionAnalysisParams {
  readonly userId: UserId;
}

export interface SuggestionAnalysisResult {
  readonly outcome: SuggestionAnalysisOutcome;
  // 기록을 읽기 전에 끝나면(권한·동의·예외) 모른다
  readonly recentTodoCount: number | null;
  readonly createdSuggestionCount: number;
}

function isStale(queuedAt: Temporal.Instant, now: Temporal.Instant): boolean {
  return Temporal.Instant.compare(queuedAt.add({ minutes: RUN_STALE_AFTER_MINUTES }), now) < 0;
}

// 사용자당 한 행인 제안 분석 실행 기록(작업 원장 행). 하루(현지 날짜)에 한 번만 요청을 받는다
export class SuggestionAnalysisRun extends Entity<UserId, SuggestionAnalysisRunProps> {
  static create(params: CreateSuggestionAnalysisRunParams): SuggestionAnalysisRun {
    return new SuggestionAnalysisRun(params.userId, {
      status: "QUEUED",
      localDate: params.localDate,
      trigger: params.trigger,
      outcome: null,
      recentTodoCount: null,
      createdSuggestionCount: null,
      queuedAt: params.now,
      startedAt: null,
      finishedAt: null,
    });
  }

  static reconstitute(primitives: SuggestionAnalysisRunPrimitives): SuggestionAnalysisRun {
    const { userId, ...props } = primitives;
    return new SuggestionAnalysisRun(UserId.reconstitute(userId), { ...props });
  }

  get outcome(): SuggestionAnalysisOutcome | null {
    return this.props.outcome;
  }

  get queueWait(): Temporal.Duration | null {
    return this.props.startedAt == null ? null : this.props.queuedAt.until(this.props.startedAt);
  }

  get finishedAt(): Temporal.Instant | null {
    return this.props.finishedAt;
  }

  request(params: RequestSuggestionAnalysisParams): boolean {
    if (this.isRequestedOn(params.localDate)) {
      return false;
    }
    this.props.status = "QUEUED";
    this.props.localDate = params.localDate;
    this.props.trigger = params.trigger;
    this.props.outcome = null;
    this.props.recentTodoCount = null;
    this.props.createdSuggestionCount = null;
    this.props.queuedAt = params.now;
    this.props.startedAt = null;
    this.props.finishedAt = null;
    return true;
  }

  // job 재시도는 이미 RUNNING이라 false다. 시작 시각은 첫 시도로 남는다
  start(localDate: Temporal.PlainDate, now: Temporal.Instant): boolean {
    if (this.props.status !== "QUEUED" || !this.isRequestedOn(localDate)) {
      return false;
    }
    this.props.status = "RUNNING";
    this.props.startedAt = now;
    return true;
  }

  finish(
    localDate: Temporal.PlainDate,
    result: SuggestionAnalysisResult,
    now: Temporal.Instant,
  ): boolean {
    if (this.props.status === "FINISHED" || !this.isRequestedOn(localDate)) {
      return false;
    }
    this.props.status = "FINISHED";
    this.props.outcome = result.outcome;
    this.props.recentTodoCount = result.recentTodoCount;
    this.props.createdSuggestionCount = result.createdSuggestionCount;
    this.props.finishedAt = now;
    return true;
  }

  isRequestedOn(localDate: Temporal.PlainDate): boolean {
    return this.props.localDate.equals(localDate);
  }

  isRunning(now: Temporal.Instant): boolean {
    return this.props.status !== "FINISHED" && !isStale(this.props.queuedAt, now);
  }

  isFinishedOn(localDate: Temporal.PlainDate): boolean {
    return this.props.status === "FINISHED" && this.isRequestedOn(localDate);
  }

  toPrimitives(): SuggestionAnalysisRunPrimitives {
    return { ...this.props, userId: this.id.value };
  }
}
