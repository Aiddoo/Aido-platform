import { VERIFICATION_CODE } from "@aido/api/vocabulary";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import { VerificationId } from "./verification-id.vo.js";
import type { VERIFICATION_VALIDITIES, VerificationType } from "./verifications.constants.js";

export interface VerificationPrimitives {
  readonly id: number;
  readonly userId: string;
  readonly type: VerificationType;
  readonly tokenHash: string;
  readonly expiresAt: Temporal.Instant;
  readonly attempts: number;
  readonly usedAt: Temporal.Instant | null;
  readonly createdAt: Temporal.Instant;
}

interface VerificationProps {
  readonly userId: UserId;
  readonly type: VerificationType;
  readonly tokenHash: string;
  readonly expiresAt: Temporal.Instant;
  attempts: number;
  usedAt: Temporal.Instant | null;
  readonly createdAt: Temporal.Instant;
}

export type VerificationValidity = (typeof VERIFICATION_VALIDITIES)[number];

/** 메일로 보낸 인증 코드 한 건. 코드 원문은 저장하지 않고 hash만 둔다 */
export class Verification extends AggregateRoot<VerificationId, VerificationProps> {
  static create(params: {
    readonly id: VerificationId;
    readonly userId: string;
    readonly type: VerificationType;
    readonly tokenHash: string;
    readonly now: Temporal.Instant;
  }): Verification {
    return new Verification(params.id, {
      userId: UserId.reconstitute(params.userId),
      type: params.type,
      tokenHash: params.tokenHash,
      expiresAt: params.now.add({ minutes: VERIFICATION_CODE.EXPIRY_MINUTES }),
      attempts: 0,
      usedAt: null,
      createdAt: params.now,
    });
  }

  static reconstitute(primitives: VerificationPrimitives): Verification {
    const { id, userId, ...props } = primitives;
    return new Verification(VerificationId.reconstitute(id), {
      ...props,
      userId: UserId.reconstitute(userId),
    });
  }

  get userId(): UserId {
    return this.props.userId;
  }

  get type(): VerificationType {
    return this.props.type;
  }

  get tokenHash(): string {
    return this.props.tokenHash;
  }

  get expiresAt(): Temporal.Instant {
    return this.props.expiresAt;
  }

  get usedAt(): Temporal.Instant | null {
    return this.props.usedAt;
  }

  validityAt(now: Temporal.Instant): VerificationValidity {
    if (this.props.usedAt != null) {
      return "used";
    }
    if (Temporal.Instant.compare(this.props.expiresAt, now) <= 0) {
      return "expired";
    }
    return this.props.attempts >= VERIFICATION_CODE.MAX_ATTEMPTS ? "exhausted" : "valid";
  }

  matches(tokenHash: string): boolean {
    return this.props.tokenHash === tokenHash;
  }

  // 쓸 수 있는 코드만 소비한다. 이미 썼거나 만료·소진이면 false다
  consume(now: Temporal.Instant): boolean {
    if (this.validityAt(now) !== "valid") {
      return false;
    }
    this.props.usedAt = now;
    return true;
  }

  // 쓸 수 있는 코드에 틀린 값을 넣었을 때만 시도로 센다
  recordFailedAttempt(now: Temporal.Instant): boolean {
    if (this.validityAt(now) !== "valid") {
      return false;
    }
    this.props.attempts += 1;
    return true;
  }

  toPrimitives(): VerificationPrimitives {
    return { id: this.id.value, ...this.props, userId: this.props.userId.value };
  }
}
