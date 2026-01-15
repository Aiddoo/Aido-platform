import { Injectable } from "@nestjs/common";

import { DatabaseService } from "@/database";
import type {
	Account,
	AccountProvider,
	Prisma,
} from "@/generated/prisma/client";

@Injectable()
export class AccountRepository {
	constructor(private readonly database: DatabaseService) {}

	/**
	 * 사용자 ID + 제공자로 계정 조회
	 */
	async findByUserIdAndProvider(
		userId: string,
		provider: AccountProvider,
	): Promise<Account | null> {
		return this.database.account.findUnique({
			where: {
				userId_provider: { userId, provider },
			},
		});
	}

	/**
	 * 제공자 계정 ID로 계정 조회 (OAuth 로그인용)
	 */
	async findByProviderAccountId(
		provider: AccountProvider,
		providerAccountId: string,
	): Promise<Account | null> {
		return this.database.account.findUnique({
			where: {
				provider_providerAccountId: { provider, providerAccountId },
			},
		});
	}

	/**
	 * Credential 계정 생성 (회원가입)
	 */
	async createCredentialAccount(
		userId: string,
		hashedPassword: string,
		tx?: Prisma.TransactionClient,
	): Promise<Account> {
		const client = tx ?? this.database;
		return client.account.create({
			data: {
				userId,
				provider: "CREDENTIAL",
				providerAccountId: userId, // userId를 사용하여 unique constraint 보장
				password: hashedPassword,
			},
		});
	}

	/**
	 * 비밀번호 업데이트
	 */
	async updatePassword(
		userId: string,
		hashedPassword: string,
		tx?: Prisma.TransactionClient,
	): Promise<Account> {
		const client = tx ?? this.database;
		return client.account.update({
			where: {
				userId_provider: { userId, provider: "CREDENTIAL" },
			},
			data: { password: hashedPassword },
		});
	}

	/**
	 * OAuth 계정 생성/연결
	 */
	async createOAuthAccount(
		data: {
			userId: string;
			provider: AccountProvider;
			providerAccountId: string;
			accessToken?: string;
			refreshToken?: string;
			accessTokenExpiresAt?: Date;
			scope?: string;
		},
		tx?: Prisma.TransactionClient,
	): Promise<Account> {
		const client = tx ?? this.database;
		return client.account.create({
			data: {
				userId: data.userId,
				provider: data.provider,
				providerAccountId: data.providerAccountId,
				accessToken: data.accessToken,
				refreshToken: data.refreshToken,
				accessTokenExpiresAt: data.accessTokenExpiresAt,
				scope: data.scope,
			},
		});
	}

	/**
	 * OAuth 토큰 갱신
	 */
	async updateOAuthTokens(
		userId: string,
		provider: AccountProvider,
		tokens: {
			accessToken: string;
			refreshToken?: string;
			accessTokenExpiresAt?: Date;
		},
		tx?: Prisma.TransactionClient,
	): Promise<Account> {
		const client = tx ?? this.database;
		return client.account.update({
			where: {
				userId_provider: { userId, provider },
			},
			data: {
				accessToken: tokens.accessToken,
				...(tokens.refreshToken && { refreshToken: tokens.refreshToken }),
				...(tokens.accessTokenExpiresAt && {
					accessTokenExpiresAt: tokens.accessTokenExpiresAt,
				}),
			},
		});
	}

	/**
	 * 계정 연결 해제
	 */
	async deleteAccount(
		userId: string,
		provider: AccountProvider,
		tx?: Prisma.TransactionClient,
	): Promise<Account> {
		const client = tx ?? this.database;
		return client.account.delete({
			where: {
				userId_provider: { userId, provider },
			},
		});
	}

	/**
	 * 사용자의 모든 계정 조회
	 */
	async findAllByUserId(userId: string): Promise<Account[]> {
		return this.database.account.findMany({
			where: { userId },
		});
	}
}
