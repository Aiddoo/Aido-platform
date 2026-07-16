import type { UserRole } from "@aido/validators";

export const AUTH_PASSWORD_HASHER = Symbol("AUTH_PASSWORD_HASHER");
export const AUTH_TOKEN_ISSUER = Symbol("AUTH_TOKEN_ISSUER");

export interface AuthPasswordHasherPort {
	hash(password: string): Promise<string>;
	verify(hash: string, password: string): Promise<boolean>;
	needsRehash(hash: string): boolean;
}

export interface TokenPair {
	accessToken: string;
	refreshToken: string;
	expiresIn: number;
}

export interface AuthTokenIssuerPort {
	generateTokenPair(
		userId: string,
		email: string,
		sessionId: string,
		role: UserRole,
		tokenFamily?: string,
		tokenVersion?: number,
	): Promise<TokenPair>;
	generateTokenFamily(): string;
	hashRefreshToken(token: string): string;
	getRefreshTokenExpiresInSeconds(): number;
}
