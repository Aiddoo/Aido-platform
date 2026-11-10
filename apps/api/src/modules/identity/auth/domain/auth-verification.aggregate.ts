import { VERIFICATION_CODE } from "@aido/api/vocabulary";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import type { AUTH_VERIFICATION_VALIDITIES, VerificationType } from "./auth.constants.js";
import { VerificationId } from "./verification-id.vo.js";

export interface AuthVerificationPrimitives {
  readonly id: number;
  readonly userId: string;
  readonly type: VerificationType;
  readonly tokenHash: string;
  readonly expiresAt: Temporal.Instant;
  readonly attempts: number;
  readonly usedAt: Temporal.Instant | null;
  readonly createdAt: Temporal.Instant;
}

type AuthVerificationProps = Omit<AuthVerificationPrimitives, "id" | "userId"> & {
  readonly userId: UserId;
};

export type AuthVerificationValidity = (typeof AUTH_VERIFICATION_VALIDITIES)[number];

/** 메일로 보낸 인증 코드 한 건. 코드 원문은 저장하지 않고 hash만 둔다 */
export class AuthVerification extends AggregateRoot<VerificationId, AuthVerificationProps> {
  static create(params: {
    readonly id: VerificationId;
    readonly userId: string;
    readonly type: VerificationType;
    readonly tokenHash: string;
    readonly now: Temporal.Instant;
  }): AuthVerification {
    return new AuthVerification(params.id, {
      userId: UserId.reconstitute(params.userId),
      type: params.type,
      tokenHash: params.tokenHash,
      expiresAt: params.now.add({ minutes: VERIFICATION_CODE.EXPIRY_MINUTES }),
      attempts: 0,
      usedAt: null,
      createdAt: params.now,
    });
  }

  static reconstitute(primitives: AuthVerificationPrimitives): AuthVerification {
    const { id, userId, ...props } = primitives;
    return new AuthVerification(VerificationId.reconstitute(id), {
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

  validityAt(now: Temporal.Instant): AuthVerificationValidity {
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

  toPrimitives(): AuthVerificationPrimitives {
    return { id: this.id.value, ...this.props, userId: this.props.userId.value };
  }
}
