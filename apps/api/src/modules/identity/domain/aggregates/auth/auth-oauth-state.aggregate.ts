import { AggregateRoot } from "#api/shared/domain/index";

export interface AuthOAuthStateProps {
  id: number;
  expiresAt: Date;
  exchangedAt: Date | null;
  mode: string | null;
  initiatingUserId: string | null;
}

export type AuthOAuthStateValidity = "valid" | "expired" | "exchanged";

export class AuthOAuthState extends AggregateRoot<AuthOAuthStateProps> {
  static reconstitute(props: AuthOAuthStateProps): AuthOAuthState {
    return new AuthOAuthState({
      id: props.id,
      expiresAt: new Date(props.expiresAt),
      exchangedAt: props.exchangedAt === null ? null : new Date(props.exchangedAt),
      mode: props.mode,
      initiatingUserId: props.initiatingUserId,
    });
  }

  get id(): number {
    return this.props.id;
  }

  get exchangedAt(): Date | null {
    return this.props.exchangedAt === null ? null : new Date(this.props.exchangedAt);
  }

  validityAt(at: Date): AuthOAuthStateValidity {
    if (this.props.exchangedAt !== null) return "exchanged";
    return this.props.expiresAt <= at ? "expired" : "valid";
  }

  canLinkFor(userId: string): boolean {
    return (
      this.props.mode === "link" &&
      (this.props.initiatingUserId === null ||
        this.props.initiatingUserId === "" ||
        this.props.initiatingUserId === userId)
    );
  }

  consume(at: Date): boolean {
    if (this.validityAt(at) !== "valid") return false;
    this.props.exchangedAt = new Date(at);
    return true;
  }
}
