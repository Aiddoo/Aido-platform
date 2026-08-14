import { AggregateRoot } from "@/shared/domain";

export interface AuthSessionProps {
	id: string;
	userId: string;
	refreshTokenHash: string;
	previousTokenHash: string | null;
	tokenFamily: string;
	tokenVersion: number;
	lastUsedAt: Date;
	expiresAt: Date;
	revokedAt: Date | null;
}

export interface AuthSessionRotationPlan {
	refreshTokenHash: string;
	tokenVersion: number;
	previousTokenHash: string;
	expectedTokenVersion: number;
	expiresAt: Date;
}

/** Refresh token 회전과 소유권 규칙을 소유하는 인증 세션 Aggregate. */
export class AuthSession extends AggregateRoot<AuthSessionProps> {
	static reconstitute(props: AuthSessionProps): AuthSession {
		return new AuthSession({
			...props,
			lastUsedAt: new Date(props.lastUsedAt),
			expiresAt: new Date(props.expiresAt),
			revokedAt: props.revokedAt ? new Date(props.revokedAt) : null,
		});
	}

	get id(): string {
		return this.props.id;
	}

	get userId(): string {
		return this.props.userId;
	}

	get refreshTokenHash(): string {
		return this.props.refreshTokenHash;
	}

	get tokenFamily(): string {
		return this.props.tokenFamily;
	}

	get tokenVersion(): number {
		return this.props.tokenVersion;
	}

	isOwnedBy(userId: string): boolean {
		return this.props.userId === userId;
	}

	isRevoked(): boolean {
		return this.props.revokedAt !== null;
	}

	wasPreviouslyIssued(refreshTokenHash: string): boolean {
		return this.props.previousTokenHash === refreshTokenHash;
	}

	isRetryWithin(refreshTokenHash: string, now: Date, gracePeriodMs: number): boolean {
		if (!this.wasPreviouslyIssued(refreshTokenHash)) {
			return false;
		}

		return now.getTime() - this.props.lastUsedAt.getTime() <= gracePeriodMs;
	}

	planRotation(
		refreshTokenHash: string,
		previousTokenHash: string,
		expiresAt: Date,
	): AuthSessionRotationPlan {
		return {
			refreshTokenHash,
			tokenVersion: this.props.tokenVersion + 1,
			previousTokenHash,
			expectedTokenVersion: this.props.tokenVersion,
			expiresAt: new Date(expiresAt),
		};
	}
}
