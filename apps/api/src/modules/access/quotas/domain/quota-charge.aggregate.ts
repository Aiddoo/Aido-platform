import type { QuotaChargeStatus, QuotaMeter } from "@aido/api/vocabulary";
import { match } from "ts-pattern";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import type { QuotaWindow } from "../../shared/domain/quota-window.vo.js";
import { QuotaChargeId } from "./quota-charge-id.vo.js";
import {
  QUOTA_ABANDONED_REFUND_REASON,
  QUOTA_CHARGE_AMOUNT,
  QUOTA_RESERVATION_TAKEOVER_AFTER_MS,
  type QuotaChargeReplay,
} from "./quotas.constants.js";

export interface QuotaChargePrimitives {
  readonly id: string;
  readonly userId: string;
  readonly meter: QuotaMeter;
  readonly idempotencyKey: string | null;
  readonly requestHash: string | null;
  readonly amount: number;
  readonly status: QuotaChargeStatus;
  readonly attempt: number;
  readonly reason: string;
  readonly refundReason: string | null;
  readonly periodKey: string;
  readonly createdAt: Temporal.Instant;
  readonly updatedAt: Temporal.Instant;
}

/** 저장할 때 다른 전이가 먼저 이겼는지 가리는 값. 전이 전에 읽어 두고 조건부 저장에 넘긴다. */
export interface QuotaChargeVersion {
  readonly status: QuotaChargeStatus;
  readonly attempt: number;
}

interface QuotaChargeProps {
  readonly userId: UserId;
  readonly meter: QuotaMeter;
  readonly idempotencyKey: string | null;
  /** 같은 키가 같은 요청인지 가리는 해시. 키가 없거나 지문을 주지 않은 요청은 null이다. */
  readonly requestHash: string | null;
  readonly amount: number;
  status: QuotaChargeStatus;
  /** 같은 키로 다시 예약할 때마다 1씩 는다. 늦게 도착한 이전 시도의 확정·환불을 무시하는 기준이다. */
  attempt: number;
  /** 차감한 작업 (예: parse-todo) */
  reason: string;
  refundReason: string | null;
  periodKey: string;
  readonly createdAt: Temporal.Instant;
  updatedAt: Temporal.Instant;
}

/** 고객 문의 때 설명할 수 있는 차감 한 건. 상태 전이는 실제로 바뀌었는지 boolean으로 돌려준다. */
export class QuotaCharge extends AggregateRoot<QuotaChargeId, QuotaChargeProps> {
  /** 사용량을 먼저 잡은 뒤 RESERVED로 만든다. 결과를 주면 확정하고 실패하면 정확히 한 번 환불한다. */
  static create(params: {
    readonly id: QuotaChargeId;
    readonly userId: UserId;
    readonly meter: QuotaMeter;
    readonly idempotencyKey: string | null;
    readonly requestHash: string | null;
    readonly reason: string;
    readonly window: QuotaWindow;
    readonly now: Temporal.Instant;
  }): QuotaCharge {
    return new QuotaCharge(params.id, {
      userId: params.userId,
      meter: params.meter,
      idempotencyKey: params.idempotencyKey,
      requestHash: params.requestHash,
      amount: QUOTA_CHARGE_AMOUNT,
      status: "RESERVED",
      attempt: 1,
      reason: params.reason,
      refundReason: null,
      periodKey: params.window.periodKey,
      createdAt: params.now,
      updatedAt: params.now,
    });
  }

  static reconstitute(primitives: QuotaChargePrimitives): QuotaCharge {
    return new QuotaCharge(QuotaChargeId.reconstitute(primitives.id), {
      userId: UserId.reconstitute(primitives.userId),
      meter: primitives.meter,
      idempotencyKey: primitives.idempotencyKey,
      requestHash: primitives.requestHash,
      amount: primitives.amount,
      status: primitives.status,
      attempt: primitives.attempt,
      reason: primitives.reason,
      refundReason: primitives.refundReason,
      periodKey: primitives.periodKey,
      createdAt: primitives.createdAt,
      updatedAt: primitives.updatedAt,
    });
  }

  get userId(): UserId {
    return this.props.userId;
  }

  get meter(): QuotaMeter {
    return this.props.meter;
  }

  get amount(): number {
    return this.props.amount;
  }

  get status(): QuotaChargeStatus {
    return this.props.status;
  }

  get attempt(): number {
    return this.props.attempt;
  }

  get reason(): string {
    return this.props.reason;
  }

  get periodKey(): string {
    return this.props.periodKey;
  }

  get version(): QuotaChargeVersion {
    return { status: this.props.status, attempt: this.props.attempt };
  }

  /** 같은 키라도 작업이나 내용이 다르면 다른 요청이다. 다시 차감하지도 결과를 돌려주지도 않는다. */
  isSameRequest(request: {
    readonly reason: string;
    readonly requestHash: string | null;
  }): boolean {
    return this.props.reason === request.reason && this.props.requestHash === request.requestHash;
  }

  resolveReplayAt(now: Temporal.Instant): QuotaChargeReplay {
    return match(this.props.status)
      .returnType<QuotaChargeReplay>()
      .with("COMMITTED", () => "COMMITTED")
      .with("REFUNDED", () => "RETRY")
      .with("RESERVED", () =>
        now.epochMilliseconds - this.props.updatedAt.epochMilliseconds >=
        QUOTA_RESERVATION_TAKEOVER_AFTER_MS
          ? "TAKE_OVER"
          : "IN_FLIGHT",
      )
      .exhaustive();
  }

  /** 환불한 차감을 같은 행에서 다시 예약한다. 순 차감은 한 번이다. */
  reserveAgain(params: {
    readonly reason: string;
    readonly window: QuotaWindow;
    readonly now: Temporal.Instant;
  }): boolean {
    if (this.props.status !== "REFUNDED") {
      return false;
    }
    this.props.status = "RESERVED";
    this.props.attempt += 1;
    this.props.reason = params.reason;
    this.props.refundReason = null;
    this.props.periodKey = params.window.periodKey;
    this.props.updatedAt = params.now;
    return true;
  }

  /**
   * 멈춘 예약을 새 시도로 이어받는다. 이전 시도의 확정·환불은 attempt가 달라 무시된다.
   * 달을 넘겼으면 호출부가 새 달 사용량을 잡고 새 기간을 넘긴다.
   */
  takeOver(params: { readonly window: QuotaWindow; readonly now: Temporal.Instant }): boolean {
    if (this.resolveReplayAt(params.now) !== "TAKE_OVER") {
      return false;
    }
    this.props.attempt += 1;
    this.props.periodKey = params.window.periodKey;
    this.props.updatedAt = params.now;
    return true;
  }

  /**
   * 확정했지만 돌려줄 결과를 잃은 요청을 같은 행에서 다시 만든다. 사용량은 이미 잡혀 있어 더하지 않는다.
   * RESERVED가 되므로 동시에 온 재요청은 처리 중으로 답하고, 다시 실패하면 평소처럼 환불한다.
   */
  reopen(now: Temporal.Instant): boolean {
    if (this.props.status !== "COMMITTED") {
      return false;
    }
    this.props.status = "RESERVED";
    this.props.attempt += 1;
    this.props.updatedAt = now;
    return true;
  }

  commit(params: { readonly attempt: number; readonly now: Temporal.Instant }): boolean {
    if (this.props.status !== "RESERVED" || this.props.attempt !== params.attempt) {
      return false;
    }
    this.props.status = "COMMITTED";
    this.props.updatedAt = params.now;
    return true;
  }

  refund(params: {
    readonly attempt: number;
    readonly reason: string;
    readonly now: Temporal.Instant;
  }): boolean {
    if (this.props.status !== "RESERVED" || this.props.attempt !== params.attempt) {
      return false;
    }
    this.props.status = "REFUNDED";
    this.props.refundReason = params.reason;
    this.props.updatedAt = params.now;
    return true;
  }

  /** 끝내 응답하지 못한 요청의 예약을 돌려준다. 이어받을 수 있을 만큼 오래된 예약만 바뀐다. */
  refundAbandoned(now: Temporal.Instant): boolean {
    if (this.resolveReplayAt(now) !== "TAKE_OVER") {
      return false;
    }
    return this.refund({ attempt: this.props.attempt, reason: QUOTA_ABANDONED_REFUND_REASON, now });
  }

  toPrimitives(): QuotaChargePrimitives {
    return {
      id: this.id.value,
      userId: this.props.userId.value,
      meter: this.props.meter,
      idempotencyKey: this.props.idempotencyKey,
      requestHash: this.props.requestHash,
      amount: this.props.amount,
      status: this.props.status,
      attempt: this.props.attempt,
      reason: this.props.reason,
      refundReason: this.props.refundReason,
      periodKey: this.props.periodKey,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
