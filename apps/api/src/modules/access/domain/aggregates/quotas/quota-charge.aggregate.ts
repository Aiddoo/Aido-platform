import type { QuotaChargeStatus, QuotaMeter } from "@aido/api/vocabulary";
import { match } from "ts-pattern";

import { AggregateRoot } from "#api/shared/domain/index";

import {
  QUOTA_ABANDONED_REFUND_REASON,
  QUOTA_CHARGE_AMOUNT,
  QUOTA_RESERVATION_TAKEOVER_AFTER_MS,
} from "../../constants/quotas/quota.constants.js";

export interface QuotaChargeProps {
  readonly id: string;
  readonly userId: string;
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
  readonly createdAt: Date;
  updatedAt: Date;
}

export type QuotaChargeDraft = Omit<QuotaChargeProps, "id" | "createdAt">;

/** 같은 Idempotency-Key로 다시 예약할 때의 판단 */
export type QuotaChargeReplay =
  /** 이미 결과를 준 요청. 다시 차감하지 않는다 */
  | "COMMITTED"
  /** 아직 처리 중인 요청. 차감 없이 충돌로 답한다 */
  | "IN_FLIGHT"
  /** 처리하던 요청이 응답하지 못하고 멈췄다. 이미 차감한 횟수로 이어받는다 */
  | "TAKE_OVER"
  /** 환불한 요청. 같은 행에서 다시 차감한다 */
  | "RETRY";

/** 고객 문의 때 설명할 수 있는 차감 한 건. 상태 전이는 실제로 바뀌었는지 boolean으로 돌려준다. */
export class QuotaCharge extends AggregateRoot<QuotaChargeProps> {
  static planReservation(input: {
    readonly userId: string;
    readonly meter: QuotaMeter;
    readonly idempotencyKey: string | null;
    readonly requestHash: string | null;
    readonly reason: string;
    readonly periodKey: string;
    readonly at: Date;
  }): QuotaChargeDraft {
    return {
      userId: input.userId,
      meter: input.meter,
      idempotencyKey: input.idempotencyKey,
      requestHash: input.requestHash,
      amount: QUOTA_CHARGE_AMOUNT,
      status: "RESERVED",
      attempt: 1,
      reason: input.reason,
      refundReason: null,
      periodKey: input.periodKey,
      updatedAt: new Date(input.at),
    };
  }

  static reconstitute(props: QuotaChargeProps): QuotaCharge {
    return new QuotaCharge({
      ...props,
      createdAt: new Date(props.createdAt),
      updatedAt: new Date(props.updatedAt),
    });
  }

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
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

  get refundReason(): string | null {
    return this.props.refundReason;
  }

  get periodKey(): string {
    return this.props.periodKey;
  }

  get updatedAt(): Date {
    return new Date(this.props.updatedAt);
  }

  /** 같은 키라도 작업이나 내용이 다르면 다른 요청이다. 다시 차감하지도 결과를 돌려주지도 않는다. */
  isSameRequest(input: { readonly reason: string; readonly requestHash: string | null }): boolean {
    return this.props.reason === input.reason && this.props.requestHash === input.requestHash;
  }

  replayAt(at: Date): QuotaChargeReplay {
    return match(this.props.status)
      .with("COMMITTED", () => "COMMITTED" as const)
      .with("REFUNDED", () => "RETRY" as const)
      .with("RESERVED", () =>
        at.getTime() - this.props.updatedAt.getTime() >= QUOTA_RESERVATION_TAKEOVER_AFTER_MS
          ? ("TAKE_OVER" as const)
          : ("IN_FLIGHT" as const),
      )
      .exhaustive();
  }

  /** 환불한 차감을 같은 행에서 다시 예약한다. 순 차감은 한 번이다. */
  reserveAgain(input: {
    readonly reason: string;
    readonly periodKey: string;
    readonly at: Date;
  }): boolean {
    if (this.props.status !== "REFUNDED") {
      return false;
    }
    this.props.status = "RESERVED";
    this.props.attempt += 1;
    this.props.reason = input.reason;
    this.props.refundReason = null;
    this.props.periodKey = input.periodKey;
    this.props.updatedAt = new Date(input.at);
    return true;
  }

  /**
   * 멈춘 예약을 새 시도로 이어받는다. 이전 시도의 확정·환불은 attempt가 달라 무시된다.
   * 달을 넘겼으면 호출부가 새 달 사용량을 잡고 새 periodKey를 넘긴다.
   */
  takeOver(input: { readonly periodKey: string; readonly at: Date }): boolean {
    if (this.replayAt(input.at) !== "TAKE_OVER") {
      return false;
    }
    this.props.attempt += 1;
    this.props.periodKey = input.periodKey;
    this.props.updatedAt = new Date(input.at);
    return true;
  }

  /**
   * 확정했지만 돌려줄 결과를 잃은 요청을 같은 행에서 다시 만든다. 사용량은 이미 잡혀 있어 더하지 않는다.
   * RESERVED가 되므로 동시에 온 재요청은 처리 중으로 답하고, 다시 실패하면 평소처럼 환불한다.
   */
  reopen(at: Date): boolean {
    if (this.props.status !== "COMMITTED") {
      return false;
    }
    this.props.status = "RESERVED";
    this.props.attempt += 1;
    this.props.updatedAt = new Date(at);
    return true;
  }

  commit(attempt: number, at: Date): boolean {
    if (this.props.status !== "RESERVED" || this.props.attempt !== attempt) {
      return false;
    }
    this.props.status = "COMMITTED";
    this.props.updatedAt = new Date(at);
    return true;
  }

  refund(input: { readonly attempt: number; readonly reason: string; readonly at: Date }): boolean {
    if (this.props.status !== "RESERVED" || this.props.attempt !== input.attempt) {
      return false;
    }
    this.props.status = "REFUNDED";
    this.props.refundReason = input.reason;
    this.props.updatedAt = new Date(input.at);
    return true;
  }

  /** 끝내 응답하지 못한 요청의 예약을 돌려준다. 이어받을 수 있을 만큼 오래된 예약만 바뀐다. */
  refundAbandoned(at: Date): boolean {
    if (this.replayAt(at) !== "TAKE_OVER") {
      return false;
    }
    return this.refund({
      attempt: this.props.attempt,
      reason: QUOTA_ABANDONED_REFUND_REASON,
      at,
    });
  }
}
