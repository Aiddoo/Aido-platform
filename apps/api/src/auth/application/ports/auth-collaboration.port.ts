import type { SubscriptionStatus, UserRole } from "@aido/validators";
import type { AccountProvider, UserStatus } from "../../domain/types";

export const AUTH_CACHE = Symbol("AUTH_CACHE");
export const AUTH_EMAIL_SENDER = Symbol("AUTH_EMAIL_SENDER");
export const AUTH_REGISTRATION_NOTIFIER = Symbol("AUTH_REGISTRATION_NOTIFIER");
export const AUTH_RUNTIME_CONFIG = Symbol("AUTH_RUNTIME_CONFIG");
export const AUTH_USER_ACTIVITY_WRITER = Symbol("AUTH_USER_ACTIVITY_WRITER");

export interface AuthCachedUserProfile {
	id: string;
	email: string;
	userTag: string;
	role: UserRole;
	status: UserStatus;
	emailVerifiedAt: string | null;
	subscriptionStatus: SubscriptionStatus;
	subscriptionExpiresAt: string | null;
	name: string | null;
	profileImage: string | null;
	createdAt: string;
	providers: AccountProvider[];
}

export interface AuthCachePort {
	invalidateSession(sessionId: string): Promise<void>;
	invalidateUserProfile(userId: string): Promise<void>;
	wrapUserProfile(
		userId: string,
		factory: () => Promise<AuthCachedUserProfile | undefined>,
	): Promise<AuthCachedUserProfile | undefined>;
}

export interface AuthEmailResult {
	success: boolean;
	error?: string;
}

export interface AuthEmailSenderPort {
	sendVerificationCode(
		to: string,
		data: { code: string; expiryMinutes: number },
	): Promise<AuthEmailResult>;
	sendPasswordResetCode(
		to: string,
		data: { code: string; expiryMinutes: number },
	): Promise<AuthEmailResult>;
	sendPasswordSetupCode(
		to: string,
		data: { code: string; expiryMinutes: number },
	): Promise<AuthEmailResult>;
}

export interface AuthUserRegisteredNotification {
	userId: string;
	email: string;
	provider: "credential" | "apple" | "google" | "kakao" | "naver";
	registeredAt: string;
}

export interface AuthRegistrationNotifierPort {
	notifyUserRegistered(payload: AuthUserRegisteredNotification): void;
}

export interface AuthRuntimeConfigPort {
	readonly isDevelopment: boolean;
}

export interface AuthUserActivityWriterPort {
	updateLastActiveAt(userId: string): Promise<void>;
}
