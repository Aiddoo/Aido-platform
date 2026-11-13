import type { PremiumGrantSource, PremiumGrantStatus } from "@aido/api/vocabulary";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import {
  isPremiumGrantActive,
  isPremiumGrantEnded,
  premiumGrantDaysOf,
  premiumGrantEndsAt,
  premiumGrantTermEndsAt,
  remainingPremiumGrantMs,
  type PremiumGrantStart,
  type PremiumGrantTerm,
} from "../../shared/premium-access.domain-service.js";
import { PremiumGrantId } from "./premium-grant-id.vo.js";
import { PREMIUM_GRANT_SOURCE_KEY_MAX_LENGTH } from "./premium-grants.constants.js";
import { invalidGrantDuration, invalidGrantSourceKey } from "./premium-grants.errors.js";

type Instant = Temporal.Instant;

export interface PremiumGrantPrimitives {
  readonly id: string;
  readonly userId: string;
  readonly source: PremiumGrantSource;
  readonly sourceKey: string;
  readonly durationDays: number;
  /** 끊고 남은 기간의 정확한 길이. null이면 durationDays일이다. */
  readonly durationMs: number | null;
  readonly status: PremiumGrantStatus;
  readonly startsAt: Instant | null;
  readonly endsAt: Instant | null;
  readonly endingNotifiedAt: Instant | null;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}

interface PremiumGrantProps {
  readonly userId: UserId;
  readonly source: PremiumGrantSource;
  readonly sourceKey: string;
  readonly durationDays: number;
  readonly durationMs: number | null;
  status: PremiumGrantStatus;
  startsAt: Instant | null;
  endsAt: Instant | null;
  // 종료 안내 시각은 안내 작업이 조건부 UPDATE로만 기록하므로 저장소가 덮어쓰지 않는다
  readonly endingNotifiedAt: Instant | null;
  readonly createdAt: Instant;
  updatedAt: Instant;
}

interface CreatePremiumGrantParams {
  readonly id: PremiumGrantId;
  readonly userId: UserId;
  readonly source: PremiumGrantSource;
  readonly sourceKey: string;
  readonly durationDays: number;
  readonly start: PremiumGrantStart;
  readonly now: Instant;
}

/** 진행 중에 끊은 기간의 남은 일수를 다시 쌓아 둔 기간의 출처 키. 끊긴 기간마다 하나뿐이다. */
export function bankedRemainderSourceKey(grantId: PremiumGrantId): string {
  return `rebank:${grantId.value}`;
}

export class PremiumGrant extends AggregateRoot<PremiumGrantId, PremiumGrantProps> {
  static create(params: CreatePremiumGrantParams): PremiumGrant {
    // 0일·음수 기간은 바로 끝나는 ACTIVE 기간을 만들고, 긴 sourceKey는 DB 오류로 늦게 드러난다
    if (!Number.isInteger(params.durationDays) || params.durationDays <= 0) {
      throw invalidGrantDuration(params.durationDays);
    }
    if (
      params.sourceKey.length === 0 ||
      params.sourceKey.length > PREMIUM_GRANT_SOURCE_KEY_MAX_LENGTH
    ) {
      throw invalidGrantSourceKey(params.sourceKey.length);
    }
    return new PremiumGrant(params.id, {
      userId: params.userId,
      source: params.source,
      sourceKey: params.sourceKey,
      durationDays: params.durationDays,
      durationMs: null,
      status: params.start.kind === "activate" ? "ACTIVE" : "BANKED",
      startsAt: params.start.kind === "activate" ? params.start.startsAt : null,
      endsAt:
        params.start.kind === "activate"
          ? premiumGrantEndsAt(params.start.startsAt, params.durationDays)
          : null,
      endingNotifiedAt: null,
      createdAt: params.now,
      updatedAt: params.now,
    });
  }

  static reconstitute(primitives: PremiumGrantPrimitives): PremiumGrant {
    return new PremiumGrant(PremiumGrantId.reconstitute(primitives.id), {
      userId: UserId.reconstitute(primitives.userId),
      source: primitives.source,
      sourceKey: primitives.sourceKey,
      durationDays: primitives.durationDays,
      durationMs: primitives.durationMs,
      status: primitives.status,
      startsAt: primitives.startsAt,
      endsAt: primitives.endsAt,
      endingNotifiedAt: primitives.endingNotifiedAt,
      createdAt: primitives.createdAt,
      updatedAt: primitives.updatedAt,
    });
  }

  get userId(): UserId {
    return this.props.userId;
  }

  get sourceKey(): string {
    return this.props.sourceKey;
  }

  get status(): PremiumGrantStatus {
    return this.props.status;
  }

  get endsAt(): Instant | null {
    return this.props.endsAt;
  }

  /** 프리미엄 판단에 필요한 값 */
  toTerm(): PremiumGrantTerm {
    return {
      id: this.id.value,
      status: this.props.status,
      durationDays: this.props.durationDays,
      durationMs: this.props.durationMs,
      startsAt: this.props.startsAt,
      endsAt: this.props.endsAt,
      createdAt: this.props.createdAt,
    };
  }

  /** 쌓아 둔 기간을 이어서 시작한다. 이미 시작했으면 false다. */
  activate(startsAt: Instant, now: Instant): boolean {
    if (this.props.status !== "BANKED") {
      return false;
    }
    this.props.status = "ACTIVE";
    this.props.startsAt = startsAt;
    this.props.endsAt = premiumGrantTermEndsAt(startsAt, this.props);
    this.props.updatedAt = now;
    return true;
  }

  /** 아직 시작하지 않은 ACTIVE 기간을 다시 쌓아 둔다. 이미 시작했거나 BANKED면 false다. */
  returnToBank(now: Instant): boolean {
    if (
      this.props.status !== "ACTIVE" ||
      this.props.startsAt == null ||
      Temporal.Instant.compare(this.props.startsAt, now) <= 0
    ) {
      return false;
    }
    this.props.status = "BANKED";
    this.props.startsAt = null;
    this.props.endsAt = null;
    this.props.updatedAt = now;
    return true;
  }

  /**
   * 진행 중인 기간을 지금 끝내고 남은 기간을 이어 받을 BANKED 기간을 돌려준다.
   * 남은 길이는 ms 그대로 남기고 표시 일수만 올린다. 같은 기간을 여러 번 끊어도 늘거나 줄지 않는다.
   * 아직 시작하지 않았거나 이미 끝난 기간이면 null이다. 처음 받은 순서를 지켜 다른 쌓아 둔 기간보다
   * 먼저 이어 붙는다.
   */
  splitAt(now: Instant, remainderId: PremiumGrantId): PremiumGrant | null {
    const term = this.toTerm();
    if (
      !isPremiumGrantActive(term, now) ||
      this.props.startsAt == null ||
      Temporal.Instant.compare(this.props.startsAt, now) > 0
    ) {
      return null;
    }
    const remainingMs = remainingPremiumGrantMs(term, now);
    this.props.status = "ENDED";
    this.props.endsAt = now;
    this.props.updatedAt = now;
    return new PremiumGrant(remainderId, {
      userId: this.props.userId,
      source: this.props.source,
      sourceKey: bankedRemainderSourceKey(this.id),
      durationDays: premiumGrantDaysOf(remainingMs),
      durationMs: remainingMs,
      status: "BANKED",
      startsAt: null,
      endsAt: null,
      endingNotifiedAt: null,
      createdAt: this.props.createdAt,
      updatedAt: now,
    });
  }

  /** 끝나는 시각이 지난 ACTIVE 기간만 끝낸다. */
  end(now: Instant): boolean {
    if (!isPremiumGrantEnded(this.toTerm(), now)) {
      return false;
    }
    this.props.status = "ENDED";
    this.props.updatedAt = now;
    return true;
  }

  /**
   * 지급을 취소한다. 쌓아 둔 기간은 시작하지 않고, 진행 중인 기간은 지금 끝낸다.
   * 이미 끝났거나 취소한 기간은 바꾸지 않고 false다.
   */
  revoke(now: Instant): boolean {
    if (this.props.status !== "BANKED" && this.props.status !== "ACTIVE") {
      return false;
    }
    if (this.props.status === "ACTIVE" && isPremiumGrantEnded(this.toTerm(), now)) {
      return false;
    }
    if (
      this.props.status === "ACTIVE" &&
      this.props.endsAt != null &&
      Temporal.Instant.compare(this.props.endsAt, now) > 0
    ) {
      this.props.endsAt = now;
    }
    this.props.status = "REVOKED";
    this.props.updatedAt = now;
    return true;
  }

  toPrimitives(): PremiumGrantPrimitives {
    return {
      id: this.id.value,
      userId: this.props.userId.value,
      source: this.props.source,
      sourceKey: this.props.sourceKey,
      durationDays: this.props.durationDays,
      durationMs: this.props.durationMs,
      status: this.props.status,
      startsAt: this.props.startsAt,
      endsAt: this.props.endsAt,
      endingNotifiedAt: this.props.endingNotifiedAt,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
