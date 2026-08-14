import type { SubscriptionStatus, UserRole } from "@aido/validators";

import type { AccountProvider, UserStatus, VerificationType } from "../../domain/types";
import type { CreateSessionData } from "../types";
import type { OAuthMode } from "./oauth-identity-provider.port";

export const AUTH_USER_REPOSITORY = Symbol("AUTH_USER_REPOSITORY");
export const AUTH_ACCOUNT_REPOSITORY = Symbol("AUTH_ACCOUNT_REPOSITORY");
export const AUTH_SESSION_REPOSITORY = Symbol("AUTH_SESSION_REPOSITORY");
export const AUTH_VERIFICATION_REPOSITORY = Symbol("AUTH_VERIFICATION_REPOSITORY");
export const AUTH_LOGIN_ATTEMPT_REPOSITORY = Symbol("AUTH_LOGIN_ATTEMPT_REPOSITORY");
export const AUTH_SECURITY_LOG_REPOSITORY = Symbol("AUTH_SECURITY_LOG_REPOSITORY");
export const AUTH_OAUTH_STATE_REPOSITORY = Symbol("AUTH_OAUTH_STATE_REPOSITORY");

export interface AuthUserRecord {
	id: string;
	email: string;
	userTag: string;
	role: UserRole;
	status: UserStatus;
	emailVerifiedAt: Date | null;
	subscriptionStatus: SubscriptionStatus;
	subscriptionExpiresAt: Date | null;
	createdAt: Date;
	deletedAt: Date | null;
}

export interface AuthUserProfileRecord extends AuthUserRecord {
	profile: { name: string | null; profileImage: string | null } | null;
	accounts: Array<{ provider: AccountProvider }>;
}

export interface AuthUserRepositoryPort {
	findByEmail(email: string): Promise<AuthUserRecord | null>;
	findById(id: string): Promise<AuthUserRecord | null>;
	findByIdWithProfile(id: string): Promise<AuthUserProfileRecord | null>;
	create(data: {
		email: string;
		status: UserStatus;
		emailVerifiedAt?: Date;
	}): Promise<AuthUserRecord>;
	createProfile(userId: string, data: { name?: string; profileImage?: string }): Promise<void>;
	markEmailVerified(id: string): Promise<unknown>;
	updateLastLoginAt(id: string): Promise<void>;
	updateProfile(
		userId: string,
		data: { name?: string | null; profileImage?: string | null },
	): Promise<{ name: string | null; profileImage: string | null }>;
	softDelete(id: string): Promise<unknown>;
	restore(id: string): Promise<unknown>;
}

export interface AuthAccountRecord {
	id: number;
	userId: string;
	provider: AccountProvider;
	providerAccountId: string;
	password: string | null;
	createdAt: Date;
}

export interface AuthAccountRepositoryPort {
	findByUserIdAndProvider(
		userId: string,
		provider: AccountProvider,
	): Promise<AuthAccountRecord | null>;
	findByProviderAccountId(
		provider: AccountProvider,
		providerAccountId: string,
	): Promise<AuthAccountRecord | null>;
	findAllByUserId(userId: string): Promise<AuthAccountRecord[]>;
	createCredentialAccount(userId: string, hashedPassword: string): Promise<unknown>;
	updatePassword(userId: string, hashedPassword: string): Promise<unknown>;
	createOAuthAccount(data: {
		userId: string;
		provider: AccountProvider;
		providerAccountId: string;
		accessToken?: string;
		refreshToken?: string;
		accessTokenExpiresAt?: Date;
		scope?: string;
	}): Promise<unknown>;
	deleteAccount(userId: string, provider: AccountProvider): Promise<unknown>;
}

export interface AuthSessionRecord {
	id: string;
	userId: string;
	refreshTokenHash: string;
	previousTokenHash: string | null;
	tokenFamily: string;
	tokenVersion: number;
	ipAddress: string;
	userAgent: string;
	lastUsedAt: Date;
	createdAt: Date;
	expiresAt: Date;
	revokedAt: Date | null;
}

export interface RotateAuthSessionInput {
	refreshTokenHash: string;
	tokenVersion: number;
	previousTokenHash: string;
	expectedTokenVersion: number;
	expiresAt: Date;
}

export interface AuthSessionRepositoryPort {
	create(data: CreateSessionData): Promise<AuthSessionRecord>;
	updateRefreshTokenHash(id: string, refreshTokenHash: string): Promise<unknown>;
	findById(id: string): Promise<AuthSessionRecord | null>;
	findByRefreshTokenHash(hash: string): Promise<AuthSessionRecord | null>;
	findActiveByUserId(userId: string): Promise<AuthSessionRecord[]>;
	rotateToken(id: string, data: RotateAuthSessionInput): Promise<AuthSessionRecord | null>;
	revoke(id: string, reason: string): Promise<unknown>;
	revokeByTokenFamily(tokenFamily: string, reason: string): Promise<number>;
	revokeAllByUserId(userId: string, reason: string, excludeSessionId?: string): Promise<number>;
}

export interface AuthVerificationRecord {
	id: number;
	userId?: string;
	type?: VerificationType;
	token: string;
	expiresAt?: Date;
	attempts: number;
	usedAt?: Date | null;
	createdAt?: Date;
}

export interface AuthVerificationRepositoryPort {
	create(data: {
		userId: string;
		type: VerificationType;
		token: string;
		expiresAt: Date;
	}): Promise<unknown>;
	findValidByUserIdAndType(
		userId: string,
		type: VerificationType,
	): Promise<AuthVerificationRecord | null>;
	markAsUsed(id: number): Promise<unknown>;
	incrementAttempts(id: number): Promise<unknown>;
	invalidateAllByUserIdAndType(userId: string, type: VerificationType): Promise<number>;
	countRecentByUserIdAndType(userId: string, type: VerificationType, since: Date): Promise<number>;
}

export interface AuthLoginAttemptRepositoryPort {
	create(data: {
		email: string;
		provider?: AccountProvider;
		ipAddress: string;
		userAgent: string;
		success: boolean;
		failureReason?: string;
	}): Promise<unknown>;
	countRecentFailuresByEmail(email: string, since: Date): Promise<number>;
}

export interface AuthSecurityLogRepositoryPort {
	create(data: {
		userId?: string;
		event: string;
		ipAddress: string;
		userAgent: string;
		metadata?: Record<string, unknown>;
	}): Promise<unknown>;
}

export interface AuthOAuthStateRecord {
	id: number;
	state: string;
	provider: AccountProvider;
	redirectUri: string;
	mode: string | null;
	initiatingUserId: string | null;
	exchangeCode: string | null;
	accessToken: string | null;
	refreshToken: string | null;
	userId: string | null;
	userName: string | null;
	profileImage: string | null;
	accountRestored: boolean | null;
}

export interface AuthOAuthStateRepositoryPort {
	create(
		state: string,
		provider: AccountProvider,
		redirectUri: string,
		options?: {
			mode?: OAuthMode;
			codeVerifier?: string;
			ipAddress?: string;
			userAgent?: string;
			expiresInMinutes?: number;
			initiatingUserId?: string;
		},
	): Promise<AuthOAuthStateRecord>;
	findByState(state: string): Promise<AuthOAuthStateRecord | null>;
	findByExchangeCode(exchangeCode: string): Promise<AuthOAuthStateRecord | null>;
	saveExchangeData(
		id: number,
		data: {
			exchangeCode: string;
			accessToken: string;
			refreshToken: string;
			userId: string;
			userName?: string;
			profileImage?: string;
			accountRestored?: boolean;
		},
	): Promise<unknown>;
	saveLinkingData(
		id: number,
		data: {
			exchangeCode: string;
			provider: AccountProvider;
			providerAccountId: string;
		},
	): Promise<unknown>;
	markAsExchanged(id: number): Promise<unknown>;
	generateExchangeCode(): string;
}

export type AuthPersistenceConflictKind = "EMAIL_ALREADY_EXISTS" | "OAUTH_ACCOUNT_ALREADY_LINKED";

export class AuthPersistenceConflict extends Error {
	constructor(readonly kind: AuthPersistenceConflictKind) {
		super(kind);
		this.name = AuthPersistenceConflict.name;
	}
}
