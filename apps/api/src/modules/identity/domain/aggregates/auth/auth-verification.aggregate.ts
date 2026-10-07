import { VERIFICATION_CODE } from "@aido/api/vocabulary";

import { AggregateRoot } from "#api/shared/domain/index";

export interface AuthVerificationProps {
  id: number;
  expiresAt: Date;
  usedAt: Date | null;
  attempts: number;
}

export type AuthVerificationValidity = "valid" | "used" | "expired" | "exhausted";

export class AuthVerification extends AggregateRoot<AuthVerificationProps> {
  static reconstitute(props: AuthVerificationProps): AuthVerification {
    return new AuthVerification({
      id: props.id,
      expiresAt: new Date(props.expiresAt),
      usedAt: props.usedAt !== null ? new Date(props.usedAt) : null,
      attempts: props.attempts,
    });
  }

  get id(): number {
    return this.props.id;
  }

  get usedAt(): Date | null {
    return this.props.usedAt !== null ? new Date(this.props.usedAt) : null;
  }

  validityAt(at: Date): AuthVerificationValidity {
    if (this.props.usedAt !== null) {
      return "used";
    }
    if (this.props.expiresAt <= at) {
      return "expired";
    }
    return this.props.attempts >= VERIFICATION_CODE.MAX_ATTEMPTS ? "exhausted" : "valid";
  }

  consume(at: Date): boolean {
    if (this.validityAt(at) !== "valid") {
      return false;
    }
    this.props.usedAt = new Date(at);
    return true;
  }
}
