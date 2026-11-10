import { VERIFICATION_CODE } from "@aido/api/vocabulary";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import type { VerificationType } from "./auth.constants.js";
import { VerificationId } from "./verification-id.vo.js";

export interface AuthVerificationPrimitives {
  readonly id: number;
  readonly userId: string;
  readonly type: VerificationType;
  readonly tokenHash: string;
  readonly expiresAt: Temporal.Instant;
  readonly attempts: number;
  readonly usedAt: Temporal.Instant | null;
}

interface AuthVerificationProps {
  readonly userId: UserId;
  readonly type: VerificationType;
  readonly tokenHash: string;
  readonly expiresAt: Temporal.Instant;
  readonly attempts: number;
  usedAt: Temporal.Instant | null;
}

export type AuthVerificationValidity = "valid" | "used" | "expired" | "exhausted";

/** 메일로 보낸 인증 코드 한 건. 코드 원문은 저장하지 않고 hash만 둔다 */
export class AuthVerification extends AggregateRoot<VerificationId, AuthVerificationProps> {
  static reconstitute(primitives: AuthVerificationPrimitives): AuthVerification {
    return new AuthVerification(VerificationId.reconstitute(primitives.id), {
      userId: UserId.reconstitute(primitives.userId),
      type: primitives.type,
      tokenHash: primitives.tokenHash,
      expiresAt: primitives.expiresAt,
      attempts: primitives.attempts,
      usedAt: primitives.usedAt,
    });
  }

  get type(): VerificationType {
    return this.props.type;
  }

  get tokenHash(): string {
    return this.props.tokenHash;
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

  consume(now: Temporal.Instant): boolean {
    if (this.validityAt(now) !== "valid") {
      return false;
    }
    this.props.usedAt = now;
    return true;
  }

  toPrimitives(): AuthVerificationPrimitives {
    return {
      id: this.id.value,
      userId: this.props.userId.value,
      type: this.props.type,
      tokenHash: this.props.tokenHash,
      expiresAt: this.props.expiresAt,
      attempts: this.props.attempts,
      usedAt: this.props.usedAt,
    };
  }
}
